import { withApiProtection } from '@/lib/api-protection';
import {
  rejectIfDatasourceLookupForbidden,
  requireBearerSession,
} from '@/lib/datasource-api-auth';
import { requireSameOriginMutation } from '@/lib/api-security';
import pool from '@/lib/db';
import {
  calculateSecureTrainingProgress,
  type TrainingProgressEvent,
} from '@/lib/training-progress-security';
import { resolveTrainingTeacherCode } from '@/lib/training-teacher-code';
import { NextRequest, NextResponse } from 'next/server';

export const POST = withApiProtection(async (request: NextRequest) => {
  try {
    const originDenied = requireSameOriginMutation(request);
    if (originDenied) return originDenied;

    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { videoId, timeSpent, isCompleted } = body;
    const requestedEvent = String(body.eventType || '').trim().toLowerCase();
    const eventType: TrainingProgressEvent =
      requestedEvent === 'start' ||
      requestedEvent === 'pause' ||
      requestedEvent === 'ended'
        ? requestedEvent
        : isCompleted === true
          ? 'ended'
          : 'heartbeat';
    // Normalize teacher_code: lowercase + trim để tránh case mismatch với các API khác
    const teacherCode: string = (body.teacherCode || '').toString().toLowerCase().trim();

    if (!teacherCode || !videoId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const { canonicalCode, aliases: allTeacherCodes } =
      await resolveTrainingTeacherCode(pool, teacherCode);

    const denied = await rejectIfDatasourceLookupForbidden(
      auth.sessionEmail,
      Boolean(auth.resolvedAccess.isAdmin),
      '',
      teacherCode,
    );
    if (denied) return denied;

    const client = await pool.connect();
    try {
      // ── 1. Lấy record hiện tại + video duration ──────────────────────────
      const [recordResult, metaResult] = await Promise.all([
        client.query(
          `SELECT time_spent_seconds, server_time_seconds, completion_status,
                  last_heartbeat_at, first_viewed_at
           FROM training_teacher_video_scores
           WHERE LOWER(TRIM(teacher_code)) = ANY($1::text[]) AND video_id = $2
           ORDER BY
             CASE completion_status
               WHEN 'completed' THEN 3
               WHEN 'watched' THEN 2
               WHEN 'in_progress' THEN 1
               ELSE 0
             END DESC,
             COALESCE(server_time_seconds, 0) DESC,
             updated_at DESC
           LIMIT 1`,
          [allTeacherCodes, videoId]
        ),
        client.query(
          `WITH anchor AS (
             SELECT id, video_group_id
             FROM training_videos
             WHERE id = $1
           ),
           source_videos AS (
             SELECT tv.id, tv.duration_minutes, tv.duration_seconds
             FROM training_videos tv
             JOIN anchor a
               ON tv.id = a.id
               OR (a.video_group_id IS NOT NULL AND tv.video_group_id = a.video_group_id)
           )
           SELECT
             COUNT(*)::int AS part_count,
             NULLIF(
               SUM(
                 CASE
                   WHEN duration_seconds IS NOT NULL AND duration_seconds > 0
                     THEN duration_seconds
                   WHEN duration_minutes IS NOT NULL AND duration_minutes > 0
                     THEN duration_minutes * 60
                   ELSE 0
                 END
               ),
               0
             ) AS duration_seconds
           FROM source_videos`,
          [videoId]
        ),
      ]);

      const existing = recordResult.rows[0] || null;
      const meta     = metaResult.rows[0] || null;

      const now = new Date();
      const videoDurationSeconds =
        meta?.duration_seconds != null ? Number(meta.duration_seconds) : 0;

      if (Number(meta?.part_count || 0) === 0 || videoDurationSeconds <= 0) {
        return NextResponse.json(
          { error: 'Video duration is unavailable' },
          { status: 409 },
        );
      }

      const secureProgress = calculateSecureTrainingProgress({
        previousPositionSeconds: Number(existing?.time_spent_seconds) || 0,
        previousServerTimeSeconds: Number(existing?.server_time_seconds) || 0,
        previousStatus: existing?.completion_status,
        lastHeartbeatAt: existing?.last_heartbeat_at,
        reportedPositionSeconds: Number(timeSpent) || 0,
        durationSeconds: videoDurationSeconds,
        eventType,
        now,
      });

      // ── 2. Sync teacher stats ────────────────────────────────────────────
      try {
        const teacherInfo = await client.query(
          `SELECT COALESCE(NULLIF(full_name,''),$1) AS full_name,
                  COALESCE(NULLIF(user_name,''),NULL) AS username,
                  COALESCE(NULLIF(work_email,''),'') AS work_email,
                  COALESCE(NULLIF(main_centre,''),NULL) AS center,
                  COALESCE(NULLIF(course_line,''),NULL) AS teaching_block
           FROM teachers WHERE code = $1 LIMIT 1`,
          [canonicalCode]
        );
        const t = teacherInfo.rows[0] || null;
        await client.query(
          `INSERT INTO training_teacher_stats
             (teacher_code, full_name, username, work_email, center, teaching_block, status, total_score)
           VALUES ($1,$2,$3,$4,$5,$6,'Active',0.00)
           ON CONFLICT (teacher_code) DO UPDATE SET
             full_name      = COALESCE(NULLIF(EXCLUDED.full_name,''), training_teacher_stats.full_name),
             username       = COALESCE(NULLIF(EXCLUDED.username,''), training_teacher_stats.username),
             work_email     = COALESCE(NULLIF(EXCLUDED.work_email,''), training_teacher_stats.work_email),
             center         = COALESCE(NULLIF(EXCLUDED.center,''), training_teacher_stats.center),
             teaching_block = COALESCE(NULLIF(EXCLUDED.teaching_block,''), training_teacher_stats.teaching_block),
             updated_at     = NOW()`,
          [canonicalCode, t?.full_name || canonicalCode, t?.username || null,
           t?.work_email || '', t?.center || null, t?.teaching_block || null]
        );
      } catch { /* non-blocking */ }

      // ── 3. Upsert trusted progress ───────────────────────────────────────
      const result = await client.query(
        `INSERT INTO training_teacher_video_scores
           (teacher_code, video_id, time_spent_seconds, server_time_seconds,
            completion_status, completed_at, updated_at, first_viewed_at,
            view_count, last_heartbeat_at)
         VALUES ($1, $2, $3, $4, $5::text,
           CASE WHEN $5::text = 'completed' THEN NOW() ELSE NULL END,
           NOW(), NOW(), 1, $6)
         ON CONFLICT (teacher_code, video_id) DO UPDATE SET
           time_spent_seconds = GREATEST(
             COALESCE(training_teacher_video_scores.time_spent_seconds, 0),
             $3
           ),
           server_time_seconds = GREATEST(
             COALESCE(training_teacher_video_scores.server_time_seconds, 0),
             $4
           ),
           last_heartbeat_at   = $6,
           view_count          = GREATEST(training_teacher_video_scores.view_count, 1),
           completion_status   = CASE
             WHEN training_teacher_video_scores.completion_status = 'completed' THEN 'completed'
             WHEN training_teacher_video_scores.completion_status = 'watched' THEN 'watched'
             ELSE $5::text
           END,
           completed_at = CASE
             WHEN training_teacher_video_scores.completion_status = 'completed'
               THEN training_teacher_video_scores.completed_at
             WHEN $5::text = 'completed' THEN NOW()
             ELSE training_teacher_video_scores.completed_at
           END,
           updated_at = NOW()
         RETURNING *`,
        [
          canonicalCode,
          videoId,
          secureProgress.acceptedPositionSeconds,
          secureProgress.serverTimeSeconds,
          secureProgress.completionStatus,
          now,
        ]
      );

      return NextResponse.json({
        success: true,
        data: result.rows[0],
        completionAccepted: secureProgress.completionAccepted,
        positionJumpRejected: secureProgress.positionJumpRejected,
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating progress:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});

export const GET = withApiProtection(async (request: NextRequest) => {
  const teacherCode = (request.nextUrl.searchParams.get('teacherCode') || '').toLowerCase().trim();
  const videoId     = request.nextUrl.searchParams.get('videoId');

  if (!teacherCode || !videoId) {
    return NextResponse.json({ error: 'Missing teacherCode or videoId' }, { status: 400 });
  }

  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const denied = await rejectIfDatasourceLookupForbidden(
      auth.sessionEmail,
      Boolean(auth.resolvedAccess.isAdmin),
      '',
      teacherCode,
    );
    if (denied) return denied;

    const { aliases: allTeacherCodes } =
      await resolveTrainingTeacherCode(pool, teacherCode);

    const result = await pool.query(
      `SELECT time_spent_seconds, server_time_seconds, completion_status, last_heartbeat_at
       FROM training_teacher_video_scores
       WHERE LOWER(TRIM(teacher_code)) = ANY($1::text[]) AND video_id = $2
       ORDER BY
         COALESCE(score, 0) DESC,
         CASE completion_status
           WHEN 'completed' THEN 3
           WHEN 'watched' THEN 2
           WHEN 'in_progress' THEN 1
           ELSE 0
         END DESC,
         COALESCE(server_time_seconds, 0) DESC,
         updated_at DESC
       LIMIT 1`,
      [allTeacherCodes, videoId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, data: null });
    }

    const row = result.rows[0];
    return NextResponse.json({
      success: true,
      data: {
        ...row,
        // time_spent_seconds là vị trí phát đã được server kiểm chứng.
        time_spent_seconds: row.time_spent_seconds || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});
