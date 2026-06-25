'use client'

import { Button } from '@/components/ui/button'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import { toast } from '@/lib/app-toast'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Loader2,
  MessageSquareText,
  MonitorCog,
  Star,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

export interface ExamFeedbackQuestion {
  id: number
  order_number: number | null
  question_text: string
}

export interface ExamFeedbackReview {
  id: number
  result_id: number
  rating: number | null
  system_comment: string
  subject_comment: string
  status: 'new' | 'in_progress' | 'done'
  question_ids: number[]
  editable: boolean
  created_at: string
  updated_at: string
}

interface ExamFeedbackFormProps {
  resultId: number
  initialQuestions?: ExamFeedbackQuestion[]
  onSaved?: (review: ExamFeedbackReview) => void
  className?: string
}

const STATUS_LABELS = {
  new: 'Mới gửi',
  in_progress: 'Đang xử lý',
  done: 'Đã xử lý',
} as const

const STATUS_CLASSES = {
  new: 'border-amber-200 bg-amber-50 text-amber-700',
  in_progress: 'border-blue-200 bg-blue-50 text-blue-700',
  done: 'border-emerald-200 bg-emerald-50 text-emerald-700',
} as const

function questionPreview(value: string) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function ExamFeedbackForm({
  resultId,
  initialQuestions = [],
  onSaved,
  className = '',
}: ExamFeedbackFormProps) {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [review, setReview] = useState<ExamFeedbackReview | null>(null)
  const [feedbackAvailable, setFeedbackAvailable] = useState(true)
  const [questions, setQuestions] =
    useState<ExamFeedbackQuestion[]>(initialQuestions)
  const [rating, setRating] = useState<number | null>(null)
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)
  const [systemComment, setSystemComment] = useState('')
  const [subjectComment, setSubjectComment] = useState('')
  const [questionIds, setQuestionIds] = useState<number[]>([])
  const [showQuestions, setShowQuestions] = useState(false)

  const applyReview = useCallback((nextReview: ExamFeedbackReview | null) => {
    setReview(nextReview)
    setRating(nextReview?.rating ?? null)
    setSystemComment(nextReview?.system_comment || '')
    setSubjectComment(nextReview?.subject_comment || '')
    setQuestionIds(
      Array.isArray(nextReview?.question_ids)
        ? nextReview.question_ids.map(Number).filter(Number.isFinite)
        : [],
    )
    setShowQuestions(Boolean(nextReview?.question_ids?.length))
  }, [])

  const loadFeedback = useCallback(async () => {
    if (!Number.isInteger(resultId) || resultId <= 0) return

    try {
      setLoading(true)
      const response = await fetch(
        `/api/exam-feedback?result_id=${encodeURIComponent(resultId)}`,
        { headers: authHeaders(token) },
      )
      const data = await response.json()
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể tải đánh giá')
      }

      applyReview(data.review || null)
      setFeedbackAvailable(
        Boolean(data.review) || data.exam?.feedback_available !== false,
      )
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        setQuestions(data.questions)
      }
    } catch (error) {
      console.error('[ExamFeedbackForm] load failed', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Không thể tải đánh giá bộ đề',
      )
    } finally {
      setLoading(false)
    }
  }, [applyReview, resultId, token])

  useEffect(() => {
    loadFeedback()
  }, [loadFeedback])

  const canSubmit = useMemo(
    () =>
      !submitting &&
      (rating !== null ||
        systemComment.trim().length > 0 ||
        subjectComment.trim().length > 0),
    [rating, systemComment, subjectComment, submitting],
  )

  const toggleQuestion = (questionId: number) => {
    setQuestionIds((current) =>
      current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : [...current, questionId],
    )
  }

  const handleSubmit = async () => {
    if (!canSubmit) return

    try {
      setSubmitting(true)
      const response = await fetch('/api/exam-feedback', {
        method: review ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          result_id: resultId,
          rating,
          system_comment: systemComment,
          subject_comment: subjectComment,
          question_ids: subjectComment.trim() ? questionIds : [],
        }),
      })
      const data = await response.json()
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể lưu đánh giá')
      }

      const savedReview = data.review as ExamFeedbackReview
      applyReview(savedReview)
      onSaved?.(savedReview)
      toast.success(review ? 'Đã cập nhật đánh giá bộ đề' : 'Đã gửi đánh giá bộ đề')
    } catch (error) {
      console.error('[ExamFeedbackForm] submit failed', error)
      toast.error(
        error instanceof Error ? error.message : 'Không thể lưu đánh giá bộ đề',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div
        className={`rounded-2xl border border-slate-200 bg-white p-6 ${className}`}
      >
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Đang tải biểu mẫu đánh giá...
        </div>
      </div>
    )
  }

  if (review && !review.editable) {
    return (
      <section
        className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6 ${className}`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-900">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-bold">Đánh giá bộ đề của bạn</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Admin đã tiếp nhận đánh giá nên nội dung hiện ở chế độ chỉ đọc.
            </p>
          </div>
          <span
            className={`inline-flex self-start rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_CLASSES[review.status]}`}
          >
            {STATUS_LABELS[review.status]}
          </span>
        </div>

        {review.rating ? (
          <div className="mt-5 flex items-center gap-1" aria-label={`${review.rating} trên 5 sao`}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Star
                key={value}
                className={`h-6 w-6 ${
                  value <= review.rating!
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-slate-200'
                }`}
              />
            ))}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {review.system_comment ? (
            <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-sky-700">
                Feedback hệ thống
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {review.system_comment}
              </p>
            </div>
          ) : null}
          {review.subject_comment ? (
            <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-rose-700">
                Feedback chuyên môn
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {review.subject_comment}
              </p>
            </div>
          ) : null}
        </div>
      </section>
    )
  }

  if (!feedbackAvailable) {
    return (
      <section
        className={`rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left ${className}`}
      >
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <h2 className="font-semibold text-amber-950">
              Chưa thể đánh giá bộ đề này
            </h2>
            <p className="mt-1 text-sm text-amber-800">
              Bài kiểm tra cũ không còn thông tin liên kết với bộ đề đã làm.
              Các bài kiểm tra mới sẽ tự động lưu thông tin này sau khi nộp bài.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-[#ead4d8] bg-white shadow-sm ${className}`}
    >
      <div className="border-b border-[#ead4d8] bg-linear-to-r from-[#fff7f8] via-white to-[#fffaf3] px-5 py-5 md:px-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[#a1001f] p-2.5 text-white shadow-sm">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Đánh giá bộ đề
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Không bắt buộc. Góp ý của bạn giúp cải thiện trải nghiệm và chất
              lượng chuyên môn cho những lần kiểm tra sau.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-5 md:p-6">
        <fieldset>
          <legend className="text-sm font-semibold text-slate-800">
            Mức độ hài lòng
          </legend>
          <div
            className="mt-3 flex items-center gap-1"
            onMouseLeave={() => setHoveredRating(null)}
          >
            {[1, 2, 3, 4, 5].map((value) => {
              const activeValue = hoveredRating ?? rating ?? 0
              const active = value <= activeValue
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(rating === value ? null : value)}
                  onMouseEnter={() => setHoveredRating(value)}
                  className="rounded-lg p-1.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
                  aria-label={`${value} sao`}
                  aria-pressed={rating === value}
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      active
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-transparent text-slate-200'
                    }`}
                  />
                </button>
              )
            })}
            <span className="ml-2 text-sm font-medium text-slate-500">
              {rating ? `${rating}/5 sao` : 'Chưa chọn'}
            </span>
          </div>
        </fieldset>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-sky-100 bg-sky-50/45 p-4">
            <label
              htmlFor={`system-feedback-${resultId}`}
              className="flex items-center gap-2 text-sm font-bold text-sky-900"
            >
              <MonitorCog className="h-4 w-4" />
              Feedback về hệ thống
            </label>
            <p className="mt-1 text-xs text-sky-700/80">
              Giao diện, lỗi hiển thị, lag, chậm hoặc thao tác chưa thuận tiện.
            </p>
            <textarea
              id={`system-feedback-${resultId}`}
              value={systemComment}
              onChange={(event) => setSystemComment(event.target.value)}
              maxLength={4000}
              rows={5}
              className="mt-3 w-full resize-y rounded-lg border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              placeholder="Ví dụ: Khi chuyển câu hỏi bị chậm khoảng 3 giây..."
            />
          </div>

          <div className="rounded-xl border border-rose-100 bg-rose-50/45 p-4">
            <label
              htmlFor={`subject-feedback-${resultId}`}
              className="flex items-center gap-2 text-sm font-bold text-rose-900"
            >
              <MessageSquareText className="h-4 w-4" />
              Feedback theo chuyên môn
            </label>
            <p className="mt-1 text-xs text-rose-700/80">
              Nội dung sai, thiếu hình ảnh, đáp án chưa phù hợp hoặc góp ý chung.
            </p>
            <textarea
              id={`subject-feedback-${resultId}`}
              value={subjectComment}
              onChange={(event) => setSubjectComment(event.target.value)}
              maxLength={4000}
              rows={5}
              className="mt-3 w-full resize-y rounded-lg border border-rose-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
              placeholder="Ví dụ: Câu 4 thiếu hình minh họa nên khó xác định đáp án..."
            />
          </div>
        </div>

        {questions.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60">
            <button
              type="button"
              onClick={() => setShowQuestions((current) => !current)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span>
                <span className="block text-sm font-semibold text-slate-800">
                  Câu hỏi liên quan
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Tùy chọn, có thể chọn nhiều câu. Đã chọn {questionIds.length}{' '}
                  câu.
                </span>
              </span>
              {showQuestions ? (
                <ChevronUp className="h-5 w-5 text-slate-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-500" />
              )}
            </button>

            {showQuestions ? (
              <div className="max-h-72 space-y-2 overflow-y-auto border-t border-slate-200 p-3">
                {questions.map((question, index) => {
                  const questionId = Number(question.id)
                  const checked = questionIds.includes(questionId)
                  return (
                    <label
                      key={question.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                        checked
                          ? 'border-rose-300 bg-white shadow-sm'
                          : 'border-transparent bg-white/70 hover:border-slate-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleQuestion(questionId)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#a1001f] focus:ring-[#a1001f]"
                      />
                      <span className="min-w-0 text-sm text-slate-700">
                        <strong className="mr-1 text-slate-900">
                          Câu {question.order_number ?? index + 1}:
                        </strong>
                        {questionPreview(question.question_text) ||
                          'Không có nội dung xem trước'}
                      </span>
                    </label>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Bạn có thể quay lại mà không cần gửi đánh giá.
          </p>
          <Button
            type="button"
            variant="mindx"
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={submitting}
            className="sm:min-w-40"
          >
            {review ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
          </Button>
        </div>
      </div>
    </section>
  )
}
