import { requireSameOriginMutation } from '@/lib/api-security'
import {
  rejectIfChuyenSauResultNotOwned,
  requireBearerSession,
} from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import { normalizeExamFeedbackInput } from '@/lib/exam-feedback'
import { NextRequest, NextResponse } from 'next/server'

type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>
}

async function loadResultContext(db: Queryable, resultId: number) {
  const result = await db.query(
    `SELECT
       r.id,
       r.ho_ten AS reviewer_name,
       r.dia_chi_email AS reviewer_email,
       r.ma_giao_vien AS reviewer_code,
       r.xu_ly_diem,
       r.diem,
       submission.submitted_at,
       COALESCE(r.id_de_thi, submission.id_de_thi, monthly_set.id_de) AS set_id,
       bd.ma_de AS set_code,
       bd.ten_de AS set_name,
       mh.ma_mon AS subject_code,
       mh.ten_mon AS subject_name
     FROM chuyen_sau_results r
     JOIN chuyen_sau_monhoc mh ON mh.id = r.id_mon
     LEFT JOIN LATERAL (
       SELECT
         exam_submission.id_de_thi,
         COALESCE(
           exam_submission.submitted_at,
           exam_submission.nop_luc,
           exam_submission.cham_luc,
           exam_submission.created_at,
           exam_submission.tao_luc
         ) AS submitted_at
       FROM chuyen_sau_bainop exam_submission
       WHERE exam_submission.id_ket_qua = r.id
       ORDER BY COALESCE(
         exam_submission.submitted_at,
         exam_submission.nop_luc,
         exam_submission.cham_luc,
         exam_submission.created_at,
         exam_submission.tao_luc
       ) DESC NULLS LAST,
       exam_submission.id DESC
       LIMIT 1
     ) submission ON TRUE
     LEFT JOIN LATERAL (
       SELECT selection.id_de
       FROM chuyen_sau_chonde_thang selection
       WHERE selection.id_mon = r.id_mon
         AND selection.nam = COALESCE(r.nam_dk, EXTRACT(YEAR FROM NOW())::int)
         AND selection.thang = COALESCE(r.thang_dk, EXTRACT(MONTH FROM NOW())::int)
       LIMIT 1
     ) monthly_set ON COALESCE(r.id_de_thi, submission.id_de_thi) IS NULL
     LEFT JOIN chuyen_sau_bode bd
       ON bd.id = COALESCE(r.id_de_thi, submission.id_de_thi, monthly_set.id_de)
     WHERE r.id = $1
     LIMIT 1`,
    [resultId],
  )

  return result.rows[0] || null
}

async function loadQuestions(db: Queryable, setId: number | null) {
  if (!setId) return []

  const result = await db.query(
    `SELECT
       question.id,
       mapping.thu_tu_hien_thi AS order_number,
       question.noi_dung_cau_hoi AS question_text
     FROM chuyen_sau_bode_cauhoi mapping
     JOIN chuyen_sau_cauhoi question ON question.id = mapping.id_cau
     WHERE mapping.id_de = $1
     ORDER BY mapping.thu_tu_hien_thi ASC, question.id ASC`,
    [setId],
  )

  return result.rows
}

async function loadReview(db: Queryable, resultId: number) {
  const result = await db.query(
    `SELECT
       review.id,
       review.result_id,
       review.set_id,
       review.set_code,
       review.set_name,
       review.subject_code,
       review.subject_name,
       review.rating,
       COALESCE(review.system_comment, '') AS system_comment,
       COALESCE(review.subject_comment, '') AS subject_comment,
       review.status,
       review.handled_by_email,
       review.handled_at,
       review.created_at,
       review.updated_at,
       COALESCE(
         jsonb_agg(link.question_id ORDER BY link.question_order, link.id)
           FILTER (WHERE link.question_id IS NOT NULL),
         '[]'::jsonb
       ) AS question_ids
     FROM exam_feedback_reviews review
     LEFT JOIN exam_feedback_review_questions link ON link.review_id = review.id
     WHERE review.result_id = $1
     GROUP BY review.id
     LIMIT 1`,
    [resultId],
  )

  return result.rows[0] || null
}

function isCompletedResult(context: any) {
  const status = String(context?.trang_thai || '').trim().toLowerCase()
  const handling = String(context?.xu_ly_diem || '').trim().toLowerCase()
  return (
    ['da_nop', 'đã_nộp', 'da_cham', 'đã_chấm'].includes(status) ||
    handling.includes('hoàn thành') ||
    handling.includes('hoan thanh') ||
    context?.diem !== null ||
    Boolean(context?.submitted_at)
  )
}

function parseResultId(value: unknown) {
  const resultId = Number(value)
  return Number.isInteger(resultId) && resultId > 0 ? resultId : null
}

async function validateSelectedQuestions(
  db: Queryable,
  setId: number,
  questionIds: number[],
) {
  if (questionIds.length === 0) return []

  const result = await db.query(
    `SELECT
       question.id,
       mapping.thu_tu_hien_thi AS order_number,
       question.noi_dung_cau_hoi AS question_text
     FROM chuyen_sau_bode_cauhoi mapping
     JOIN chuyen_sau_cauhoi question ON question.id = mapping.id_cau
     WHERE mapping.id_de = $1
       AND question.id = ANY($2::int[])
     ORDER BY mapping.thu_tu_hien_thi ASC, question.id ASC`,
    [setId, questionIds],
  )

  if (result.rows.length !== questionIds.length) {
    throw new Error('Một hoặc nhiều câu hỏi không thuộc bộ đề đã làm')
  }

  return result.rows
}

async function insertQuestionLinks(
  db: Queryable,
  reviewId: number,
  questions: any[],
) {
  for (const question of questions) {
    await db.query(
      `INSERT INTO exam_feedback_review_questions (
         review_id,
         question_id,
         question_order,
         question_text_snapshot
       ) VALUES ($1, $2, $3, $4)`,
      [
        reviewId,
        Number(question.id),
        question.order_number == null ? null : Number(question.order_number),
        String(question.question_text || ''),
      ],
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const resultId = parseResultId(request.nextUrl.searchParams.get('result_id'))
    if (!resultId) {
      return NextResponse.json(
        { success: false, error: 'result_id không hợp lệ' },
        { status: 400 },
      )
    }

    const denied = await rejectIfChuyenSauResultNotOwned(
      auth.sessionEmail,
      auth.privileged,
      String(resultId),
    )
    if (denied) return denied

    const context = await loadResultContext(pool, resultId)
    if (!context) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy lần làm bài' },
        { status: 404 },
      )
    }

    const [review, questions] = await Promise.all([
      loadReview(pool, resultId),
      loadQuestions(pool, Number(context.set_id) || null),
    ])

    return NextResponse.json({
      success: true,
      review: review
        ? {
            ...review,
            editable: review.status === 'new',
          }
        : null,
      questions,
      exam: {
        result_id: resultId,
        set_id: context.set_id,
        set_code: context.set_code,
        set_name: context.set_name,
        subject_code: context.subject_code,
        subject_name: context.subject_name,
        completed: isCompletedResult(context),
        feedback_available: Boolean(context.set_id),
      },
    })
  } catch (error) {
    console.error('[exam-feedback][GET]', error)
    return NextResponse.json(
      { success: false, error: 'Không thể tải đánh giá bộ đề' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const originDenied = requireSameOriginMutation(request)
  if (originDenied) return originDenied

  const auth = await requireBearerSession(request)
  if (!auth.ok) return auth.response

  let client: any = null
  try {
    const body = await request.json()
    const resultId = parseResultId(body?.resultId ?? body?.result_id)
    if (!resultId) {
      return NextResponse.json(
        { success: false, error: 'result_id không hợp lệ' },
        { status: 400 },
      )
    }

    const denied = await rejectIfChuyenSauResultNotOwned(
      auth.sessionEmail,
      auth.privileged,
      String(resultId),
    )
    if (denied) return denied

    const input = normalizeExamFeedbackInput({
      rating: body?.rating,
      systemComment: body?.systemComment ?? body?.system_comment,
      subjectComment: body?.subjectComment ?? body?.subject_comment,
      questionIds: body?.questionIds ?? body?.question_ids,
    })

    client = await pool.connect()
    await client.query('BEGIN')

    const context = await loadResultContext(client, resultId)
    if (!context) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy lần làm bài' },
        { status: 404 },
      )
    }
    if (!isCompletedResult(context)) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { success: false, error: 'Chỉ được đánh giá sau khi hoàn thành bài kiểm tra' },
        { status: 409 },
      )
    }
    if (!context.set_id) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { success: false, error: 'Không xác định được bộ đề đã làm' },
        { status: 409 },
      )
    }

    const selectedQuestionIds = input.subjectComment ? input.questionIds : []
    const selectedQuestions = await validateSelectedQuestions(
      client,
      Number(context.set_id),
      selectedQuestionIds,
    )

    const inserted = await client.query(
      `INSERT INTO exam_feedback_reviews (
         result_id,
         set_id,
         set_code,
         set_name,
         subject_code,
         subject_name,
         reviewer_email,
         reviewer_code,
         reviewer_name,
         rating,
         system_comment,
         subject_comment
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        resultId,
        Number(context.set_id),
        context.set_code || null,
        context.set_name || null,
        context.subject_code || null,
        context.subject_name || null,
        auth.sessionEmail.toLowerCase(),
        context.reviewer_code || null,
        context.reviewer_name || null,
        input.rating,
        input.systemComment || null,
        input.subjectComment || null,
      ],
    )

    await insertQuestionLinks(client, Number(inserted.rows[0].id), selectedQuestions)
    await client.query('COMMIT')

    return NextResponse.json(
      {
        success: true,
        review: {
          ...(await loadReview(pool, resultId)),
          editable: true,
        },
      },
      { status: 201 },
    )
  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(() => undefined)
    if (error?.code === '23505') {
      return NextResponse.json(
        { success: false, error: 'Bạn đã gửi đánh giá cho lần làm bài này' },
        { status: 409 },
      )
    }
    const message =
      error instanceof Error ? error.message : 'Không thể gửi đánh giá bộ đề'
    const status = /rating|nội dung đánh giá|ký tự|câu hỏi/i.test(message) ? 400 : 500
    console.error('[exam-feedback][POST]', error)
    return NextResponse.json({ success: false, error: message }, { status })
  } finally {
    client?.release()
  }
}

export async function PUT(request: NextRequest) {
  const originDenied = requireSameOriginMutation(request)
  if (originDenied) return originDenied

  const auth = await requireBearerSession(request)
  if (!auth.ok) return auth.response

  let client: any = null
  try {
    const body = await request.json()
    const resultId = parseResultId(body?.resultId ?? body?.result_id)
    if (!resultId) {
      return NextResponse.json(
        { success: false, error: 'result_id không hợp lệ' },
        { status: 400 },
      )
    }

    const denied = await rejectIfChuyenSauResultNotOwned(
      auth.sessionEmail,
      auth.privileged,
      String(resultId),
    )
    if (denied) return denied

    const input = normalizeExamFeedbackInput({
      rating: body?.rating,
      systemComment: body?.systemComment ?? body?.system_comment,
      subjectComment: body?.subjectComment ?? body?.subject_comment,
      questionIds: body?.questionIds ?? body?.question_ids,
    })

    client = await pool.connect()
    await client.query('BEGIN')

    const context = await loadResultContext(client, resultId)
    if (!context?.set_id) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { success: false, error: 'Không xác định được bộ đề đã làm' },
        { status: 404 },
      )
    }

    const current = await client.query(
      `SELECT id, status
       FROM exam_feedback_reviews
       WHERE result_id = $1
       FOR UPDATE`,
      [resultId],
    )
    if (current.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy đánh giá để cập nhật' },
        { status: 404 },
      )
    }
    if (current.rows[0].status !== 'new') {
      await client.query('ROLLBACK')
      return NextResponse.json(
        {
          success: false,
          error: 'Đánh giá đã được admin tiếp nhận nên không thể chỉnh sửa',
        },
        { status: 409 },
      )
    }

    const selectedQuestionIds = input.subjectComment ? input.questionIds : []
    const selectedQuestions = await validateSelectedQuestions(
      client,
      Number(context.set_id),
      selectedQuestionIds,
    )
    const reviewId = Number(current.rows[0].id)

    await client.query(
      `UPDATE exam_feedback_reviews
       SET rating = $2,
           system_comment = $3,
           subject_comment = $4
       WHERE id = $1`,
      [
        reviewId,
        input.rating,
        input.systemComment || null,
        input.subjectComment || null,
      ],
    )
    await client.query(
      'DELETE FROM exam_feedback_review_questions WHERE review_id = $1',
      [reviewId],
    )
    await insertQuestionLinks(client, reviewId, selectedQuestions)
    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      review: {
        ...(await loadReview(pool, resultId)),
        editable: true,
      },
    })
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined)
    const message =
      error instanceof Error ? error.message : 'Không thể cập nhật đánh giá bộ đề'
    const status = /rating|nội dung đánh giá|ký tự|câu hỏi/i.test(message) ? 400 : 500
    console.error('[exam-feedback][PUT]', error)
    return NextResponse.json({ success: false, error: message }, { status })
  } finally {
    client?.release()
  }
}
