import { promises as fs } from 'fs'
import path from 'path'
import pool from '@/lib/db'
import { createNotification, createNotificationForEveryone } from '@/lib/notification-service'
import {
  exportOriginalCheckCongRowsByKeys,
  type CheckCongRecord,
} from '@/lib/check-cong-service'

export type CheckCongFeedbackStatus = 'pending' | 'approved' | 'rejected'

export type CheckCongFeedback = {
  id: number
  checkKey: string
  teacherEmail: string
  teacherName: string
  username: string
  centre: string
  workType: string
  className: string
  course: string
  courseLine: string
  roleType: string
  slotTime: string
  statusSnapshot: string
  studentCount: number | null
  slotDuration: number
  effectiveDuration: number
  feedbackContent: string
  feedbackStatus: CheckCongFeedbackStatus
  reviewerEmail: string | null
  reviewerNote: string | null
  reviewedAt: string | null
  exportedAt: string | null
  createdAt: string
  updatedAt: string
}

export type CheckCongFeedbackSetting = {
  isOpen: boolean
  opensAt: string | null
  closesAt: string | null
  updatedByEmail: string | null
  updatedAt: string | null
  canSubmit: boolean
}

type StoredCheckCongFeedbackSetting = Omit<CheckCongFeedbackSetting, 'canSubmit'>

type CheckCongFeedbackStore = {
  version: 1
  nextId: number
  setting: StoredCheckCongFeedbackSetting
  feedbacks: CheckCongFeedback[]
}

const STORE_PATH = path.join(process.cwd(), 'data', 'check-cong-feedback-store.json')

const defaultSetting = (): StoredCheckCongFeedbackSetting => ({
  isOpen: false,
  opensAt: null,
  closesAt: null,
  updatedByEmail: null,
  updatedAt: null,
})

const defaultStore = (): CheckCongFeedbackStore => ({
  version: 1,
  nextId: 1,
  setting: defaultSetting(),
  feedbacks: [],
})

let writeQueue = Promise.resolve()

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function isWithinWindow(setting: StoredCheckCongFeedbackSetting) {
  if (!setting.isOpen) return false
  const now = Date.now()
  const opensAt = setting.opensAt ? new Date(setting.opensAt).getTime() : null
  const closesAt = setting.closesAt ? new Date(setting.closesAt).getTime() : null
  return (opensAt == null || now >= opensAt) && (closesAt == null || now <= closesAt)
}

function withSubmitState(setting: StoredCheckCongFeedbackSetting): CheckCongFeedbackSetting {
  return {
    ...setting,
    canSubmit: isWithinWindow(setting),
  }
}

function formatDeadline(raw: Date | string | null) {
  if (!raw) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(raw))
}

async function readStore(): Promise<CheckCongFeedbackStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<CheckCongFeedbackStore>
    return {
      version: 1,
      nextId: Math.max(1, Number(parsed.nextId || 1)),
      setting: {
        ...defaultSetting(),
        ...(parsed.setting || {}),
      },
      feedbacks: Array.isArray(parsed.feedbacks) ? parsed.feedbacks : [],
    }
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return importLegacyDbStore()
    }
    throw error
  }
}

function mapLegacyFeedbackRow(row: Record<string, unknown>): CheckCongFeedback {
  return {
    id: Number(row.id),
    checkKey: String(row.check_key ?? ''),
    teacherEmail: String(row.teacher_email ?? ''),
    teacherName: String(row.teacher_name ?? ''),
    username: String(row.username ?? ''),
    centre: String(row.centre ?? ''),
    workType: String(row.work_type ?? ''),
    className: String(row.class_name ?? ''),
    course: String(row.course ?? ''),
    courseLine: String(row.course_line ?? ''),
    roleType: String(row.role_type ?? ''),
    slotTime: String(row.slot_time ?? ''),
    statusSnapshot: String(row.status_snapshot ?? ''),
    studentCount: row.student_count == null ? null : Number(row.student_count),
    slotDuration: Number(row.slot_duration ?? 0),
    effectiveDuration: Number(row.effective_duration ?? 0),
    feedbackContent: String(row.feedback_content ?? ''),
    feedbackStatus: String(row.feedback_status || 'pending') as CheckCongFeedbackStatus,
    reviewerEmail: row.reviewer_email == null ? null : String(row.reviewer_email),
    reviewerNote: row.reviewer_note == null ? null : String(row.reviewer_note),
    reviewedAt: row.reviewed_at == null ? null : new Date(String(row.reviewed_at)).toISOString(),
    exportedAt: row.exported_at == null ? null : new Date(String(row.exported_at)).toISOString(),
    createdAt: row.created_at == null ? new Date().toISOString() : new Date(String(row.created_at)).toISOString(),
    updatedAt: row.updated_at == null ? new Date().toISOString() : new Date(String(row.updated_at)).toISOString(),
  }
}

async function importLegacyDbStore(): Promise<CheckCongFeedbackStore> {
  try {
    const [settingResult, feedbackResult] = await Promise.all([
      pool.query(
        `SELECT is_open, opens_at, closes_at, updated_by_email, updated_at
         FROM check_cong_feedback_settings
         WHERE id = 1`,
      ),
      pool.query(`SELECT * FROM check_cong_feedbacks ORDER BY id ASC`),
    ])
    const legacySetting = settingResult.rows[0]
    const feedbacks = feedbackResult.rows.map(mapLegacyFeedbackRow)
    const maxId = feedbacks.reduce((max, feedback) => Math.max(max, feedback.id), 0)

    return {
      version: 1,
      nextId: maxId + 1,
      setting: legacySetting
        ? {
            isOpen: Boolean(legacySetting.is_open),
            opensAt: legacySetting.opens_at
              ? new Date(legacySetting.opens_at).toISOString()
              : null,
            closesAt: legacySetting.closes_at
              ? new Date(legacySetting.closes_at).toISOString()
              : null,
            updatedByEmail: legacySetting.updated_by_email ?? null,
            updatedAt: legacySetting.updated_at
              ? new Date(legacySetting.updated_at).toISOString()
              : null,
          }
        : defaultSetting(),
      feedbacks,
    }
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === '42P01') {
      return defaultStore()
    }
    throw error
  }
}

async function writeStore(store: CheckCongFeedbackStore) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  const tmpPath = `${STORE_PATH}.tmp`
  await fs.writeFile(tmpPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
  await fs.rename(tmpPath, STORE_PATH)
}

async function updateStore<T>(
  mutator: (store: CheckCongFeedbackStore) => Promise<T> | T,
): Promise<T> {
  const run = async () => {
    const store = await readStore()
    const result = await mutator(store)
    await writeStore(store)
    return result
  }

  const next = writeQueue.then(run, run)
  writeQueue = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

async function closeExpiredFeedbackWindow(store: CheckCongFeedbackStore) {
  const setting = store.setting
  if (
    !setting.isOpen &&
    setting.closesAt &&
    new Date(setting.closesAt).getTime() < Date.now()
  ) {
    store.setting = {
      ...setting,
      opensAt: null,
      closesAt: null,
      updatedAt: new Date().toISOString(),
    }
    return
  }

  if (
    setting.isOpen &&
    setting.closesAt &&
    new Date(setting.closesAt).getTime() < Date.now()
  ) {
    store.setting = {
      ...setting,
      isOpen: false,
      opensAt: null,
      closesAt: null,
      updatedAt: new Date().toISOString(),
    }
    await Promise.allSettled([
      notifyCheckCongTeachersFeedbackClosed(),
      notifyCheckCongReviewersForClosing(),
    ])
  }
}

export async function getCheckCongFeedbackSetting(): Promise<CheckCongFeedbackSetting> {
  return updateStore(async (store) => {
    await closeExpiredFeedbackWindow(store)
    return withSubmitState(store.setting)
  })
}

export async function updateCheckCongFeedbackSetting(input: {
  isOpen: boolean
  opensAt?: string | null
  closesAt?: string | null
  updatedByEmail: string
}) {
  const transition = await updateStore(async (store) => {
    await closeExpiredFeedbackWindow(store)
    const previous = store.setting
    const now = new Date().toISOString()
    store.setting = {
      isOpen: input.isOpen,
      opensAt: input.isOpen ? input.opensAt || null : null,
      closesAt: input.isOpen ? input.closesAt || null : null,
      updatedByEmail: normalizeEmail(input.updatedByEmail),
      updatedAt: now,
    }

    return {
      setting: withSubmitState(store.setting),
      opened: store.setting.isOpen && !previous.isOpen,
      closed: previous.isOpen && !store.setting.isOpen,
    }
  })

  if (transition.opened) {
    await notifyCheckCongTeachersFeedbackOpened(transition.setting.closesAt)
  }
  if (transition.closed) {
    await Promise.allSettled([
      notifyCheckCongTeachersFeedbackClosed(),
      notifyCheckCongReviewersForClosing(),
    ])
  }

  return transition.setting
}

async function notifyCheckCongTeachersFeedbackOpened(closesAt: Date | string | null) {
  const deadline = closesAt ? ` Hạn phản hồi đến ${formatDeadline(closesAt)}.` : ''

  await createNotificationForEveryone({
    title: 'Đợt "Phản hồi công" đã mở',
    content: `Đợt "Phản hồi công" đã mở.${deadline}`,
    type: 'check_cong_feedback_open',
    link: '/user/thong-tin-giao-vien?tab=checkCongFeedback',
  })
}

async function notifyCheckCongTeachersFeedbackClosed() {
  await createNotificationForEveryone({
    title: 'Đợt "Phản hồi công" đã đóng',
    content: 'Đợt "Phản hồi công" đã đóng. Bạn có thể theo dõi kết quả duyệt trong tab Phản hồi công.',
    type: 'check_cong_feedback_closed',
    link: '/user/thong-tin-giao-vien?tab=checkCongFeedback',
  })
}

export async function getFeedbacksForTeacher(email: string) {
  const normalized = normalizeEmail(email)
  const store = await readStore()
  return store.feedbacks
    .filter((feedback) => normalizeEmail(feedback.teacherEmail) === normalized)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getFeedbacksForKeys(checkKeys: string[]) {
  const keys = new Set(checkKeys.filter(Boolean))
  if (keys.size === 0) return new Map<string, CheckCongFeedback>()
  const store = await readStore()
  return new Map(
    store.feedbacks
      .filter((feedback) => keys.has(feedback.checkKey))
      .map((feedback) => [feedback.checkKey, feedback]),
  )
}

export async function submitCheckCongFeedback(input: {
  record: CheckCongRecord
  teacherEmail: string
  content: string
}) {
  if (input.record.status !== 'UNCHECKED') {
    throw new Error('Chỉ phản hồi được các ca Unchecked')
  }

  const setting = await getCheckCongFeedbackSetting()
  if (!setting.canSubmit) {
    throw new Error('Hiện chưa mở thời gian phản hồi công')
  }

  const normalizedEmail = normalizeEmail(input.teacherEmail)
  const now = new Date().toISOString()
  return updateStore((store) => {
    const existingIndex = store.feedbacks.findIndex(
      (feedback) =>
        feedback.checkKey === input.record.checkKey &&
        normalizeEmail(feedback.teacherEmail) === normalizedEmail,
    )
    const current = existingIndex >= 0 ? store.feedbacks[existingIndex] : null
    const feedback: CheckCongFeedback = {
      id: current?.id ?? store.nextId++,
      checkKey: input.record.checkKey,
      teacherEmail: normalizedEmail,
      teacherName: input.record.teacherName,
      username: input.record.username,
      centre: input.record.centre,
      workType: input.record.type,
      className: input.record.className,
      course: input.record.course,
      courseLine: input.record.courseLine,
      roleType: input.record.roleType,
      slotTime: input.record.slotTime,
      statusSnapshot: input.record.status,
      studentCount: input.record.studentCount,
      slotDuration: input.record.slotDuration,
      effectiveDuration: input.record.effectiveDuration,
      feedbackContent: input.content.trim(),
      feedbackStatus: 'pending',
      reviewerEmail: null,
      reviewerNote: null,
      reviewedAt: null,
      exportedAt: null,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    }

    if (existingIndex >= 0) {
      store.feedbacks[existingIndex] = feedback
    } else {
      store.feedbacks.push(feedback)
    }

    return feedback
  })
}

async function notifyCheckCongReviewersForClosing() {
  const reviewers = await pool.query(
    `SELECT DISTINCT LOWER(TRIM(email)) AS email
     FROM app_users
     WHERE is_active IS TRUE
       AND role IN ('super_admin', 'admin', 'manager')
       AND NULLIF(TRIM(email), '') IS NOT NULL`,
  )
  await Promise.allSettled(
    reviewers.rows.map((row) =>
      createNotification({
        recipientEmail: String(row.email),
        title: 'Kiểm tra phản hồi công chung',
        content: 'Đợt "Phản hồi công" đã đóng. Vui lòng kiểm tra và duyệt các phản hồi công đang Pending.',
        type: 'check_cong_feedback_review_batch',
        link: '/admin/check-cong?tab=feedback',
      }),
    ),
  )
}

export async function listCheckCongFeedbacks(input: {
  status?: string
  month?: string
}) {
  const store = await readStore()
  return store.feedbacks
    .filter((feedback) => {
      if (input.status && input.status !== 'all' && feedback.feedbackStatus !== input.status) {
        return false
      }
      if (input.month && /^\d{4}-\d{2}$/.test(input.month)) {
        return feedback.createdAt.startsWith(input.month)
      }
      return true
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 500)
}

export async function reviewCheckCongFeedback(input: {
  id: number
  status: 'approved' | 'rejected'
  reviewerEmail: string
  reviewerNote?: string
}) {
  const feedback = await updateStore((store) => {
    const index = store.feedbacks.findIndex((item) => item.id === input.id)
    if (index < 0) throw new Error('Không tìm thấy phản hồi')
    const updated: CheckCongFeedback = {
      ...store.feedbacks[index],
      feedbackStatus: input.status,
      reviewerEmail: normalizeEmail(input.reviewerEmail),
      reviewerNote: input.reviewerNote?.trim() || null,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    store.feedbacks[index] = updated
    return updated
  })

  await createNotification({
    recipientEmail: feedback.teacherEmail,
    title:
      input.status === 'approved'
        ? 'Đơn phản hồi công đã được duyệt'
        : 'Đơn phản hồi công chưa được duyệt',
    content:
      input.status === 'approved'
        ? 'Đơn phản hồi công của bạn đã được duyệt.'
        : input.reviewerNote?.trim() || 'Đơn phản hồi công của bạn chưa được duyệt.',
    type: 'check_cong_feedback_reviewed',
    link: '/user/thong-tin-giao-vien?tab=checkCongFeedback',
  })
  return feedback
}

export async function exportApprovedCheckCongFeedbackCsv() {
  const rows = await listCheckCongFeedbacks({ status: 'approved' })
  const pendingExport = rows.filter((row) => !row.exportedAt)
  const exported = await exportOriginalCheckCongRowsByKeys(
    pendingExport.map((row) => row.checkKey),
  )

  if (pendingExport.length > 0) {
    const exportedIds = new Set(pendingExport.map((row) => row.id))
    await updateStore((store) => {
      const now = new Date().toISOString()
      store.feedbacks = store.feedbacks.map((feedback) =>
        exportedIds.has(feedback.id)
          ? { ...feedback, exportedAt: now, updatedAt: now }
          : feedback,
      )
    })
  }

  return { csv: exported.csv, count: exported.count }
}
