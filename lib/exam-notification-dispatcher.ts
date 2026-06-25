import type { PoolClient } from 'pg'

import {
  EXAM_REMINDER_MINUTES,
  REGISTRATION_OPEN_HOUR,
  getExamNotificationDedupePrefix,
} from './exam-notification-schedule'

const DISPATCH_JOB_NAME = 'exam_schedule_notifications'
const DISPATCH_INTERVAL_SECONDS = 30
const LOCAL_THROTTLE_MS = 30_000

let nextLocalDispatchAt = 0

export interface ExamNotificationDispatchResult {
  registrationOpened: number
  registrationClosed: number
  examReminders: number
  skipped: boolean
}

const SKIPPED_RESULT: ExamNotificationDispatchResult = {
  registrationOpened: 0,
  registrationClosed: 0,
  examReminders: 0,
  skipped: true,
}

function isMissingDispatchSchema(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  return code === '42P01' || code === '42703'
}

export async function processDueExamScheduleNotifications(
  client: PoolClient,
): Promise<ExamNotificationDispatchResult> {
  const localNow = Date.now()
  if (localNow < nextLocalDispatchAt) {
    return SKIPPED_RESULT
  }
  nextLocalDispatchAt = localNow + LOCAL_THROTTLE_MS

  let transactionStarted = false
  try {
    await client.query('BEGIN')
    transactionStarted = true

    const lockResult = await client.query<{ acquired: boolean }>(
      `SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired`,
      [DISPATCH_JOB_NAME],
    )
    if (!lockResult.rows[0]?.acquired) {
      await client.query('ROLLBACK')
      transactionStarted = false
      return SKIPPED_RESULT
    }

    await client.query(
      `INSERT INTO notification_dispatch_state (job_name, last_processed_at)
       VALUES ($1, CURRENT_TIMESTAMP)
       ON CONFLICT (job_name) DO NOTHING`,
      [DISPATCH_JOB_NAME],
    )

    const stateResult = await client.query<{
      last_processed_at: Date
      current_at: Date
      elapsed_seconds: number
    }>(
      `SELECT
         last_processed_at,
         CURRENT_TIMESTAMP AS current_at,
         EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_processed_at))::int AS elapsed_seconds
       FROM notification_dispatch_state
       WHERE job_name = $1
       FOR UPDATE`,
      [DISPATCH_JOB_NAME],
    )

    const state = stateResult.rows[0]
    if (!state || state.elapsed_seconds < DISPATCH_INTERVAL_SECONDS) {
      await client.query('COMMIT')
      transactionStarted = false
      return SKIPPED_RESULT
    }

    const dispatchResult = await client.query<{
      registration_opened: number
      registration_closed: number
      exam_reminders: number
    }>(
      `WITH bounds AS (
         SELECT
           $1::timestamptz AT TIME ZONE 'Asia/Bangkok' AS last_wall_time,
           $2::timestamptz AT TIME ZONE 'Asia/Bangkok' AS current_wall_time
       ),
       active_recipients AS (
         SELECT LOWER(TRIM(email)) AS recipient_email
         FROM app_users
         WHERE is_active IS TRUE
           AND NULLIF(TRIM(email), '') IS NOT NULL

         UNION

         SELECT LOWER(
           TRIM(
             COALESCE(
               NULLIF(TRIM(work_email), ''),
               NULLIF(TRIM("Work email"), '')
             )
           )
         ) AS recipient_email
         FROM teachers
         WHERE LOWER(
           TRIM(
             COALESCE(
               NULLIF(TRIM(status), ''),
               NULLIF(TRIM("Status"), ''),
               'active'
             )
           )
         ) NOT IN ('deactive', 'inactive', 'disabled')
       ),
       registration_open_events AS (
         SELECT es.*
         FROM event_schedules es
         CROSS JOIN bounds
         WHERE LOWER(TRIM(COALESCE(es.loai_su_kien, ''))) IN ('registration', 'dang_ky')
           AND LOWER(TRIM(COALESCE(es.trang_thai, 'scheduled'))) NOT IN ('cancelled', 'completed')
           AND date_trunc('day', es.bat_dau_luc) + make_interval(hours => $3)
             > bounds.last_wall_time
           AND date_trunc('day', es.bat_dau_luc) + make_interval(hours => $3)
             <= bounds.current_wall_time
           AND es.ket_thuc_luc > bounds.current_wall_time
       ),
       registration_closed_events AS (
         SELECT es.*
         FROM event_schedules es
         CROSS JOIN bounds
         WHERE LOWER(TRIM(COALESCE(es.loai_su_kien, ''))) IN ('registration', 'dang_ky')
           AND LOWER(TRIM(COALESCE(es.trang_thai, 'scheduled'))) <> 'cancelled'
           AND es.ket_thuc_luc > bounds.last_wall_time
           AND es.ket_thuc_luc <= bounds.current_wall_time
       ),
       exam_reminder_events AS (
         SELECT es.*
         FROM event_schedules es
         CROSS JOIN bounds
         WHERE LOWER(TRIM(COALESCE(es.loai_su_kien, ''))) IN ('exam', 'thi')
           AND LOWER(TRIM(COALESCE(es.trang_thai, 'scheduled'))) NOT IN ('cancelled', 'completed')
           AND es.bat_dau_luc - make_interval(mins => $4) > bounds.last_wall_time
           AND es.bat_dau_luc - make_interval(mins => $4) <= bounds.current_wall_time
           AND es.bat_dau_luc > bounds.current_wall_time
       ),
       registration_opened AS (
         INSERT INTO notifications (
           recipient_email,
           title,
           content,
           type,
           link,
           is_read,
           created_at,
           dedupe_key
         )
         SELECT
           recipients.recipient_email,
           'Mở đăng ký kiểm tra',
           'Đợt "' || events.ten || '" đã mở đăng ký. Hạn đăng ký đến '
             || TO_CHAR(events.ket_thuc_luc, 'HH24:MI DD/MM/YYYY') || '.',
           'exam',
           '/user/hoat-dong-hang-thang',
           FALSE,
           CURRENT_TIMESTAMP,
           $5 || events.id::text
         FROM registration_open_events events
         CROSS JOIN active_recipients recipients
         WHERE recipients.recipient_email IS NOT NULL
           AND POSITION('@' IN recipients.recipient_email) > 1
         ON CONFLICT DO NOTHING
         RETURNING id
       ),
       registration_closed AS (
         INSERT INTO notifications (
           recipient_email,
           title,
           content,
           type,
           link,
           is_read,
           created_at,
           dedupe_key
         )
         SELECT
           recipients.recipient_email,
           'Đã hết thời gian đăng ký kiểm tra',
           'Đợt "' || events.ten || '" đã kết thúc đăng ký lúc '
             || TO_CHAR(events.ket_thuc_luc, 'HH24:MI DD/MM/YYYY') || '.',
           'exam',
           '/user/hoat-dong-hang-thang',
           FALSE,
           CURRENT_TIMESTAMP,
           $6 || events.id::text
         FROM registration_closed_events events
         CROSS JOIN active_recipients recipients
         WHERE recipients.recipient_email IS NOT NULL
           AND POSITION('@' IN recipients.recipient_email) > 1
         ON CONFLICT DO NOTHING
         RETURNING id
       ),
       registered_exam_recipients AS (
         SELECT DISTINCT
           events.id AS event_id,
           events.ten,
           events.bat_dau_luc,
           LOWER(
             TRIM(
               COALESCE(
                 NULLIF(TRIM(results.dia_chi_email), ''),
                 NULLIF(TRIM(teachers.work_email), ''),
                 NULLIF(TRIM(teachers."Work email"), '')
               )
             )
           ) AS recipient_email
         FROM exam_reminder_events events
         JOIN chuyen_sau_results results
           ON results.id_su_kien = events.id
         LEFT JOIN teachers
           ON LOWER(TRIM(teachers.code)) = LOWER(TRIM(results.ma_giao_vien))
       ),
       exam_reminders AS (
         INSERT INTO notifications (
           recipient_email,
           title,
           content,
           type,
           link,
           is_read,
           created_at,
           dedupe_key
         )
         SELECT
           recipients.recipient_email,
           'Kiểm tra bắt đầu sau 10 phút',
           'Bài kiểm tra "' || recipients.ten || '" sẽ bắt đầu lúc '
             || TO_CHAR(recipients.bat_dau_luc, 'HH24:MI DD/MM/YYYY')
             || '. Vui lòng chuẩn bị vào làm bài.',
           'exam',
           '/user/assignments',
           FALSE,
           CURRENT_TIMESTAMP,
           $7 || recipients.event_id::text
         FROM registered_exam_recipients recipients
         WHERE recipients.recipient_email IS NOT NULL
           AND POSITION('@' IN recipients.recipient_email) > 1
         ON CONFLICT DO NOTHING
         RETURNING id
       )
       SELECT
         (SELECT COUNT(*)::int FROM registration_opened) AS registration_opened,
         (SELECT COUNT(*)::int FROM registration_closed) AS registration_closed,
         (SELECT COUNT(*)::int FROM exam_reminders) AS exam_reminders`,
      [
        state.last_processed_at,
        state.current_at,
        REGISTRATION_OPEN_HOUR,
        EXAM_REMINDER_MINUTES,
        getExamNotificationDedupePrefix('registration_open'),
        getExamNotificationDedupePrefix('registration_closed'),
        getExamNotificationDedupePrefix('exam_reminder'),
      ],
    )

    await client.query(
      `UPDATE notification_dispatch_state
       SET last_processed_at = $2, updated_at = CURRENT_TIMESTAMP
       WHERE job_name = $1`,
      [DISPATCH_JOB_NAME, state.current_at],
    )

    await client.query('COMMIT')
    transactionStarted = false

    const counts = dispatchResult.rows[0]
    return {
      registrationOpened: counts?.registration_opened || 0,
      registrationClosed: counts?.registration_closed || 0,
      examReminders: counts?.exam_reminders || 0,
      skipped: false,
    }
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK').catch(() => undefined)
    }
    nextLocalDispatchAt = 0

    if (!isMissingDispatchSchema(error)) {
      console.error('[ExamNotificationDispatcher] Dispatch failed:', error)
    }
    return SKIPPED_RESULT
  }
}
