import { fetchQCTemplates, QC_SHEET_ID } from '@/lib/qc-templates'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const force = request.nextUrl.searchParams.get('refresh') === '1'
    const templates = await fetchQCTemplates(force)
    return NextResponse.json({
      success: true,
      sheetId: QC_SHEET_ID,
      templates,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải mẫu QC'
    console.error('[quan-ly-qc/templates] error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
