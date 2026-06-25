export const EXAM_FEEDBACK_STATUSES = ['new', 'in_progress', 'done'] as const

export type ExamFeedbackStatus = (typeof EXAM_FEEDBACK_STATUSES)[number]

export interface ExamFeedbackInput {
  rating?: unknown
  systemComment?: unknown
  subjectComment?: unknown
  questionIds?: unknown
}

export interface NormalizedExamFeedbackInput {
  rating: number | null
  systemComment: string
  subjectComment: string
  questionIds: number[]
}

const MAX_COMMENT_LENGTH = 4000

function normalizeComment(value: unknown, label: string) {
  const normalized = String(value ?? '').trim()
  if (normalized.length > MAX_COMMENT_LENGTH) {
    throw new Error(`${label} không được vượt quá ${MAX_COMMENT_LENGTH} ký tự`)
  }
  return normalized
}

export function normalizeQuestionIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<number>()
  const normalized: number[] = []

  for (const item of value) {
    const questionId = Number(item)
    if (!Number.isInteger(questionId) || questionId <= 0 || seen.has(questionId)) {
      continue
    }

    seen.add(questionId)
    normalized.push(questionId)
  }

  return normalized
}

export function normalizeExamFeedbackInput(
  input: ExamFeedbackInput,
): NormalizedExamFeedbackInput {
  const rawRating = input?.rating
  let rating: number | null = null

  if (rawRating !== undefined && rawRating !== null && rawRating !== '') {
    const parsedRating = Number(rawRating)
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      throw new Error('Rating phải là số nguyên từ 1 đến 5')
    }
    rating = parsedRating
  }

  const systemComment = normalizeComment(
    input?.systemComment,
    'Feedback hệ thống',
  )
  const subjectComment = normalizeComment(
    input?.subjectComment,
    'Feedback chuyên môn',
  )

  if (rating === null && !systemComment && !subjectComment) {
    throw new Error(
      'Vui lòng nhập ít nhất một nội dung đánh giá hoặc chọn rating',
    )
  }

  return {
    rating,
    systemComment,
    subjectComment,
    questionIds: normalizeQuestionIds(input?.questionIds),
  }
}

export function isExamFeedbackStatus(
  value: unknown,
): value is ExamFeedbackStatus {
  return EXAM_FEEDBACK_STATUSES.includes(value as ExamFeedbackStatus)
}

export function isValidExamFeedbackStatusTransition(
  current: ExamFeedbackStatus,
  next: ExamFeedbackStatus,
) {
  if (current === next) return true
  return (
    (current === 'new' && next === 'in_progress') ||
    (current === 'in_progress' && next === 'done')
  )
}
