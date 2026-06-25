import {
  requireBearerAdminOrSuper,
  requireBearerAdminOrSuperMutation,
} from '@/lib/auth-server'
import pool from '@/lib/db'
import {
  isExamFeedbackStatus,
  isValidExamFeedbackStatusTransition,
} from '@/lib/exam-feedback'
import { NextRequest, NextResponse } from 'next/server'

function positiveInteger(value: unknown, fallback: number, max?: number) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return max ? Math.min(parsed, max) : parsed
}

function isMissingFeedbackTable(error: any) {
  return error?.code === '42P01'
}

export async function GET(request: NextRequest) {
  const auth = await requireBearerAdminOrSuper(request)
  if (!auth.ok) return auth.response

  try {
    const params = request.nextUrl.searchParams
    const page = positiveInteger(params.get('page'), 1)
    const pageSize = positiveInteger(params.get('page_size'), 20, 100)
    const month = String(params.get('month') || '').trim()
    const subjectCode = String(params.get('subject_code') || '').trim()
    const setId = Number(params.get('set_id'))
    const status = String(params.get('status') || '').trim()
    const feedbackType = String(params.get('feedback_type') || '').trim()
    const queryText = String(params.get('query') || '').trim()

    const conditions: string[] = []
    const values: unknown[] = []
    const addCondition = (sql: string, value: unknown) => {
      values.push(value)
      conditions.push(sql.replace('?', `$${values.length}`))
    }

    if (/^\d{4}-\d{2}$/.test(month)) {
      addCondition(
        `TO_CHAR(COALESCE(submission.submitted_at, review.created_at), 'YYYY-MM') = ?`,
        month,
      )
    }
    if (subjectCode) {
      addCondition('review.subject_code = ?', subjectCode)
    }
    if (Number.isInteger(setId) && setId > 0) {
      addCondition('review.set_id = ?', setId)
    }
    if (isExamFeedbackStatus(status)) {
      addCondition('review.status = ?', status)
    }
    if (feedbackType === 'system') {
      conditions.push(`LENGTH(BTRIM(COALESCE(review.system_comment, ''))) > 0`)
    } else if (feedbackType === 'subject') {
      conditions.push(`LENGTH(BTRIM(COALESCE(review.subject_comment, ''))) > 0`)
    } else if (feedbackType === 'rating') {
      conditions.push('review.rating IS NOT NULL')
    }
    if (queryText) {
      addCondition(
        `CONCAT_WS(
          ' ',
          review.reviewer_name,
          review.reviewer_email,
          review.reviewer_code,
          review.subject_code,
          review.subject_name,
          review.set_code,
          review.set_name
        ) ILIKE '%' || ? || '%'`,
        queryText,
      )
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const baseFrom = `
      FROM exam_feedback_reviews review
      LEFT JOIN chuyen_sau_results result ON result.id = review.result_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          exam_submission.submitted_at,
          exam_submission.nop_luc,
          exam_submission.cham_luc,
          exam_submission.created_at,
          exam_submission.tao_luc
        ) AS submitted_at
        FROM chuyen_sau_bainop exam_submission
        WHERE exam_submission.id_ket_qua = result.id
        ORDER BY COALESCE(
          exam_submission.submitted_at,
          exam_submission.nop_luc,
          exam_submission.cham_luc,
          exam_submission.created_at,
          exam_submission.tao_luc
        ) DESC NULLS LAST
        LIMIT 1
      ) submission ON TRUE
    `

    const [summaryResult, distributionResult, totalResult, optionResult] =
      await Promise.all([
        pool.query(
          `SELECT
             COUNT(*)::int AS total_reviews,
             ROUND(AVG(review.rating)::numeric, 2) AS average_rating,
             COUNT(review.rating)::int AS rating_count,
             COUNT(*) FILTER (
               WHERE LENGTH(BTRIM(COALESCE(review.system_comment, ''))) > 0
             )::int AS system_feedback_count,
             COUNT(*) FILTER (
               WHERE LENGTH(BTRIM(COALESCE(review.subject_comment, ''))) > 0
             )::int AS subject_feedback_count,
             COUNT(*) FILTER (WHERE review.status <> 'done')::int AS pending_count
           ${baseFrom}
           ${where}`,
          values,
        ),
        pool.query(
          `SELECT review.rating, COUNT(*)::int AS count
           ${baseFrom}
           ${where}
           ${where ? 'AND' : 'WHERE'} review.rating IS NOT NULL
           GROUP BY review.rating
           ORDER BY review.rating`,
          values,
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count
           ${baseFrom}
           ${where}`,
          values,
        ),
        pool.query(
          `SELECT
             COALESCE(
               jsonb_agg(DISTINCT jsonb_build_object(
                 'code', review.subject_code,
                 'name', review.subject_name
               )) FILTER (WHERE review.subject_code IS NOT NULL),
               '[]'::jsonb
             ) AS subjects,
             COALESCE(
               jsonb_agg(DISTINCT jsonb_build_object(
                 'id', review.set_id,
                 'code', review.set_code,
                 'name', review.set_name,
                 'subject_code', review.subject_code
               )) FILTER (WHERE review.set_id IS NOT NULL),
               '[]'::jsonb
             ) AS sets
           FROM exam_feedback_reviews review`,
        ),
      ])

    const rowValues = [...values, pageSize, (page - 1) * pageSize]
    const limitParam = `$${values.length + 1}`
    const offsetParam = `$${values.length + 2}`
    const rowsResult = await pool.query(
      `SELECT
         review.id,
         review.result_id,
         review.set_id,
         review.set_code,
         review.set_name,
         review.subject_code,
         review.subject_name,
         review.reviewer_email,
         review.reviewer_code,
         review.reviewer_name,
         review.rating,
         COALESCE(review.system_comment, '') AS system_comment,
         COALESCE(review.subject_comment, '') AS subject_comment,
         review.status,
         review.handled_by_email,
         review.handled_at,
         review.created_at,
         review.updated_at,
         submission.submitted_at,
         COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id', link.question_id,
               'order_number', link.question_order,
               'question_text', link.question_text_snapshot
             )
             ORDER BY link.question_order, link.id
           ) FILTER (WHERE link.id IS NOT NULL),
           '[]'::jsonb
         ) AS questions
       ${baseFrom}
       LEFT JOIN exam_feedback_review_questions link ON link.review_id = review.id
       ${where}
       GROUP BY review.id, submission.submitted_at
       ORDER BY review.created_at DESC
       LIMIT ${limitParam}
       OFFSET ${offsetParam}`,
      rowValues,
    )

    const summary = summaryResult.rows[0] || {}
    const ratingDistribution = Object.fromEntries(
      [1, 2, 3, 4, 5].map((rating) => [rating, 0]),
    )
    for (const item of distributionResult.rows) {
      ratingDistribution[Number(item.rating)] = Number(item.count)
    }

    const options = optionResult.rows[0] || { subjects: [], sets: [] }
    const subjects = Array.isArray(options.subjects)
      ? options.subjects.sort((a: any, b: any) =>
          String(a.name || a.code || '').localeCompare(
            String(b.name || b.code || ''),
            'vi',
          ),
        )
      : []
    const sets = Array.isArray(options.sets)
      ? options.sets.sort((a: any, b: any) =>
          String(a.code || '').localeCompare(String(b.code || ''), 'vi'),
        )
      : []

    return NextResponse.json({
      success: true,
      summary: {
        total_reviews: Number(summary.total_reviews || 0),
        average_rating:
          summary.average_rating == null ? null : Number(summary.average_rating),
        rating_count: Number(summary.rating_count || 0),
        system_feedback_count: Number(summary.system_feedback_count || 0),
        subject_feedback_count: Number(summary.subject_feedback_count || 0),
        pending_count: Number(summary.pending_count || 0),
        rating_distribution: ratingDistribution,
      },
      items: rowsResult.rows,
      filters: { subjects, sets },
      pagination: {
        page,
        page_size: pageSize,
        total: Number(totalResult.rows[0]?.count || 0),
      },
    })
  } catch (error: any) {
    console.error('[exam-feedback/admin][GET]', error)
    return NextResponse.json(
      {
        success: false,
        error: isMissingFeedbackTable(error)
          ? 'Chưa có bảng đánh giá bộ đề. Vui lòng chạy migration mới nhất.'
          : 'Không thể tải thống kê đánh giá bộ đề',
      },
      { status: isMissingFeedbackTable(error) ? 503 : 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireBearerAdminOrSuperMutation(request)
  if (!auth.ok) return auth.response

  let client: any = null
  try {
    const body = await request.json()
    const id = Number(body?.id)
    const nextStatus = body?.status

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: 'id không hợp lệ' },
        { status: 400 },
      )
    }
    if (!isExamFeedbackStatus(nextStatus)) {
      return NextResponse.json(
        { success: false, error: 'Trạng thái không hợp lệ' },
        { status: 400 },
      )
    }

    client = await pool.connect()
    await client.query('BEGIN')
    const current = await client.query(
      `SELECT id, status
       FROM exam_feedback_reviews
       WHERE id = $1
       FOR UPDATE`,
      [id],
    )

    if (current.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy đánh giá' },
        { status: 404 },
      )
    }

    const currentStatus = current.rows[0].status
    if (
      !isExamFeedbackStatus(currentStatus) ||
      !isValidExamFeedbackStatusTransition(currentStatus, nextStatus)
    ) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        {
          success: false,
          error: `Không thể chuyển từ ${currentStatus} sang ${nextStatus}`,
        },
        { status: 409 },
      )
    }

    const updated = await client.query(
      `UPDATE exam_feedback_reviews
       SET status = $2,
           handled_by_email = CASE
             WHEN $2 = 'new' THEN handled_by_email
             ELSE $3
           END,
           handled_at = CASE
             WHEN $2 = 'done' THEN COALESCE(handled_at, CURRENT_TIMESTAMP)
             ELSE NULL
           END
       WHERE id = $1
       RETURNING *`,
      [id, nextStatus, auth.sessionEmail],
    )
    await client.query('COMMIT')

    return NextResponse.json({ success: true, item: updated.rows[0] })
  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(() => undefined)
    console.error('[exam-feedback/admin][PATCH]', error)
    return NextResponse.json(
      {
        success: false,
        error: isMissingFeedbackTable(error)
          ? 'Chưa có bảng đánh giá bộ đề. Vui lòng chạy migration mới nhất.'
          : 'Không thể cập nhật trạng thái đánh giá',
      },
      { status: isMissingFeedbackTable(error) ? 503 : 500 },
    )
  } finally {
    client?.release()
  }
}
