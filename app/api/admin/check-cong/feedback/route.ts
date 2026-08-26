import {
  getCheckCongFeedbackSetting,
  listCheckCongFeedbacks,
  reviewCheckCongFeedback,
  updateCheckCongFeedbackSetting,
} from '@/lib/check-cong-feedback'
import {
  requireBearerDbRoles,
  requireBearerDbRolesMutation,
} from '@/lib/auth-server'
import { NextRequest, NextResponse } from 'next/server'

const REVIEW_ROLES = ['super_admin', 'admin', 'manager']

export async function GET(request: NextRequest) {
  const gate = await requireBearerDbRoles(request, REVIEW_ROLES)
  if (!gate.ok) return gate.response

  try {
    const status = String(request.nextUrl.searchParams.get('status') || 'all')
    const month = String(request.nextUrl.searchParams.get('month') || 'all')
    const [setting, feedbacks] = await Promise.all([
      getCheckCongFeedbackSetting(),
      listCheckCongFeedbacks({ status, month }),
    ])
    return NextResponse.json({ success: true, setting, feedbacks })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Không thể tải phản hồi công'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireBearerDbRolesMutation(request, REVIEW_ROLES)
  if (!gate.ok) return gate.response

  try {
    const body = (await request.json().catch(() => ({}))) as {
      isOpen?: boolean
      opensAt?: string | null
      closesAt?: string | null
    }
    const setting = await updateCheckCongFeedbackSetting({
      isOpen: Boolean(body.isOpen),
      opensAt: body.opensAt || null,
      closesAt: body.closesAt || null,
      updatedByEmail: gate.sessionEmail,
    })
    return NextResponse.json({ success: true, setting })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Không thể cập nhật lịch phản hồi'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requireBearerDbRolesMutation(request, REVIEW_ROLES)
  if (!gate.ok) return gate.response

  try {
    const body = (await request.json().catch(() => ({}))) as {
      id?: number
      status?: 'approved' | 'rejected'
      reviewerNote?: string
    }
    const id = Number(body.id)
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: 'Thiếu phản hồi cần duyệt' },
        { status: 400 },
      )
    }
    if (body.status !== 'approved' && body.status !== 'rejected') {
      return NextResponse.json(
        { success: false, error: 'Trạng thái duyệt không hợp lệ' },
        { status: 400 },
      )
    }

    const feedback = await reviewCheckCongFeedback({
      id,
      status: body.status,
      reviewerEmail: gate.sessionEmail,
      reviewerNote: body.reviewerNote,
    })
    return NextResponse.json({ success: true, feedback })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Không thể duyệt phản hồi công'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
