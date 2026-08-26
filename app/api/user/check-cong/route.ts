import { withApiProtection } from '@/lib/api-protection'
import { requireBearerOrSessionCookie } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import { getTeacherCheckCong } from '@/lib/check-cong-service'
import {
  getCheckCongFeedbackSetting,
  getFeedbacksForKeys,
  submitCheckCongFeedback,
} from '@/lib/check-cong-feedback'
import { NextRequest, NextResponse } from 'next/server'

const RATE_TABLE = new Map(
  [
    ['T0', 45000],
    ['T1', 50000],
    ['T2', 55000],
    ['T3', 60000],
    ['T4', 65000],
    ['T5', 70000],
    ['T6', 75000],
    ['T7', 80000],
    ['T8', 85000],
    ['T9', 90000],
    ['T10', 95000],
    ['T11', 100000],
    ['T12', 105000],
    ['T13', 110000],
    ['T14', 115000],
    ['T15', 120000],
    ['T16', 125000],
    ['T17', 130000],
    ['T18', 135000],
    ['T19', 140000],
    ['T20', 145000],
  ].map(([level, rate]) => [String(level), Number(rate)]),
)

function parseRate(value: unknown): number | null {
  const raw = String(value ?? '').trim().toUpperCase()
  if (!raw) return null
  const tableRate = RATE_TABLE.get(raw)
  if (tableRate) return tableRate

  const normalized = raw.replace(/\s/g, '').replace(/\u00A0/g, '')
  let parsed: number | null = null
  if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(normalized)) {
    parsed = Number(normalized.replace(/,/g, ''))
  } else if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    parsed = Number(normalized.replace(/\./g, ''))
  } else if (/^\d+$/.test(normalized)) {
    parsed = Number(normalized)
  }

  return parsed && Number.isFinite(parsed) ? parsed : null
}

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const auth = await requireBearerOrSessionCookie(request)
    if (!auth.ok) return auth.response

    const month = String(request.nextUrl.searchParams.get('month') || 'all')
    const teacherRes = await pool.query(
      `
      SELECT code, user_name, work_email, personal_email, full_name,
             rate_k12_check, rank_k12_check
      FROM teachers
      WHERE LOWER(TRIM(work_email)) = LOWER(TRIM($1))
         OR LOWER(TRIM("Work email")) = LOWER(TRIM($1))
      LIMIT 1
    `,
      [auth.sessionEmail],
    )

    if (teacherRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy hồ sơ giáo viên' },
        { status: 404 },
      )
    }

    const teacher = teacherRes.rows[0] as Record<string, unknown>
    const rate = parseRate(teacher.rate_k12_check)
    const checkCong = await getTeacherCheckCong({
      email: auth.sessionEmail,
      personalEmail: String(teacher.personal_email ?? ''),
      username: String(teacher.user_name ?? ''),
      code: String(teacher.code ?? ''),
      month,
      hourlyRate: rate,
    })

    const feedbacks = await getFeedbacksForKeys(
      checkCong.records.map((record) => record.checkKey),
    )
    const records = checkCong.records.map((record) => ({
      ...record,
      feedback: feedbacks.get(record.checkKey) ?? null,
    }))
    const feedbackSetting = await getCheckCongFeedbackSetting()

    return NextResponse.json({
      success: true,
      teacher: {
        code: teacher.code,
        userName: teacher.user_name,
        fullName: teacher.full_name,
        rate,
        rank: teacher.rank_k12_check,
      },
      ...checkCong,
      records,
      feedbackSetting,
      estimatedSalary: checkCong.summary.estimatedSalary,
      grossEstimatedSalary: checkCong.summary.grossEstimatedSalary,
      salaryTaxAmount: checkCong.summary.salaryTaxAmount,
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Không thể tải dữ liệu check công'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})

export const POST = withApiProtection(async (request: NextRequest) => {
  try {
    const auth = await requireBearerOrSessionCookie(request)
    if (!auth.ok) return auth.response

    const body = (await request.json().catch(() => ({}))) as {
      checkKey?: string
      content?: string
      month?: string
    }
    const checkKey = String(body.checkKey || '').trim()
    const content = String(body.content || '').trim()
    if (!checkKey) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã dòng công cần phản hồi' },
        { status: 400 },
      )
    }

    const teacherRes = await pool.query(
      `
      SELECT code, user_name, work_email, personal_email, full_name,
             rate_k12_check, rank_k12_check
      FROM teachers
      WHERE LOWER(TRIM(work_email)) = LOWER(TRIM($1))
         OR LOWER(TRIM("Work email")) = LOWER(TRIM($1))
      LIMIT 1
    `,
      [auth.sessionEmail],
    )

    if (teacherRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy hồ sơ giáo viên' },
        { status: 404 },
      )
    }

    const teacher = teacherRes.rows[0] as Record<string, unknown>
    const checkCong = await getTeacherCheckCong({
      email: auth.sessionEmail,
      personalEmail: String(teacher.personal_email ?? ''),
      username: String(teacher.user_name ?? ''),
      code: String(teacher.code ?? ''),
      month: String(body.month || 'all'),
      hourlyRate: parseRate(teacher.rate_k12_check),
    })
    const record = checkCong.records.find((item) => item.checkKey === checkKey)
    if (!record) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy dòng công thuộc tài khoản này' },
        { status: 404 },
      )
    }

    const feedback = await submitCheckCongFeedback({
      record,
      teacherEmail: auth.sessionEmail,
      content,
    })

    return NextResponse.json({ success: true, feedback })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Không thể gửi phản hồi công'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
