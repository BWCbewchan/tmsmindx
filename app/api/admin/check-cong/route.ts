import { requireBearerDbRoles, requireBearerSuperAdmin } from '@/lib/auth-server'
import { getAdminCheckCong, saveCheckCongCsv } from '@/lib/check-cong-service'
import { clientIpFromRequest, rateLimitOr429 } from '@/lib/rate-limit-memory'
import { NextRequest, NextResponse } from 'next/server'

const MAX_CSV_BYTES = 25 * 1024 * 1024

export async function GET(request: NextRequest) {
  const gate = await requireBearerDbRoles(request, [
    'super_admin',
    'admin',
    'manager',
  ])
  if (!gate.ok) return gate.response

  try {
    const month = String(request.nextUrl.searchParams.get('month') || 'all')
    const page = Number(request.nextUrl.searchParams.get('page') || '1')
    const limit = Number(request.nextUrl.searchParams.get('limit') || '20')
    const status = String(request.nextUrl.searchParams.get('status') || 'all')
    const query = String(request.nextUrl.searchParams.get('q') || '')
    const data = await getAdminCheckCong({ month, page, limit, status, query })
    return NextResponse.json({ success: true, ...data })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Không thể tải dữ liệu check công'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireBearerSuperAdmin(request)
  if (!gate.ok) return gate.response

  const rl = rateLimitOr429(
    `admin-check-cong-upload:${clientIpFromRequest(request)}`,
    10,
    60_000,
  )
  if (rl) return rl

  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, error: 'Vui lòng chọn file CSV' },
        { status: 400 },
      )
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: 'Chỉ hỗ trợ upload file .csv' },
        { status: 400 },
      )
    }

    if (file.size > MAX_CSV_BYTES) {
      return NextResponse.json(
        { success: false, error: 'File CSV vượt quá 25MB' },
        { status: 400 },
      )
    }

    const csvText = Buffer.from(await file.arrayBuffer()).toString('utf8')
    const result = await saveCheckCongCsv(csvText)
    const month = String(formData.get('month') || 'all')
    const data = await getAdminCheckCong({ month, page: 1, limit: 20 })

    return NextResponse.json({
      success: true,
      uploaded: {
        fileName: file.name,
        size: file.size,
        recordCount: result.recordCount,
      },
      ...data,
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Không thể upload file CSV'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
