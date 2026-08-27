import { requireCandidateSession } from '@/lib/candidate-session'
import pool from '@/lib/db'
import { ensureTrainingDocumentsTable } from '@/lib/hr-training-documents'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const candidateAuth = await requireCandidateSession(request)
  if (!candidateAuth.ok) return candidateAuth.response

  try {
    await ensureTrainingDocumentsTable(pool)
    const result = await pool.query(
      `SELECT id, title, description, document_url, stage, session_number, sort_order, status, created_at, updated_at
       FROM hr_training_documents
       WHERE status = 'active'
       ORDER BY stage ASC, session_number ASC NULLS LAST, sort_order ASC, created_at DESC`,
    )

    return NextResponse.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('[Candidate Training Documents GET]', error)
    return NextResponse.json({ success: false, error: 'Không thể tải tài liệu đào tạo.' }, { status: 500 })
  }
}
