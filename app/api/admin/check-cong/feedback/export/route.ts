import { exportApprovedCheckCongFeedbackCsv } from '@/lib/check-cong-feedback'
import { requireBearerDbRoles } from '@/lib/auth-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const gate = await requireBearerDbRoles(request, [
    'super_admin',
    'admin',
    'manager',
  ])
  if (!gate.ok) return gate.response

  try {
    const result = await exportApprovedCheckCongFeedbackCsv()
    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="check-cong-feedback-approved-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
        'X-Exported-Count': String(result.count),
      },
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Không thể export phản hồi công'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
