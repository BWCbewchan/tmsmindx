import { requireBearerAdminOrSuperMutation } from '@/lib/auth-server'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import {
  ensureTrainingDocumentsTable,
  normalizeTrainingDocumentStage,
  normalizeTrainingDocumentStatus,
} from '@/lib/hr-training-documents'
import { NextRequest, NextResponse } from 'next/server'

function toNumberOrNull(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function toSortOrder(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 100
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireBearerSession(request)
  if (!auth.ok) return auth.response

  try {
    await ensureTrainingDocumentsTable(pool)
    const stage = request.nextUrl.searchParams.get('stage')
    const status = request.nextUrl.searchParams.get('status')
    const params: unknown[] = []
    const conditions: string[] = []

    if (stage && stage !== 'all') {
      params.push(normalizeTrainingDocumentStage(stage))
      conditions.push(`stage = $${params.length}`)
    }
    if (status && status !== 'all') {
      params.push(normalizeTrainingDocumentStatus(status))
      conditions.push(`status = $${params.length}`)
    }

    const result = await pool.query(
      `SELECT id, title, description, document_url, stage, session_number, sort_order, status, created_at, updated_at
       FROM hr_training_documents
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY stage ASC, session_number ASC NULLS LAST, sort_order ASC, created_at DESC`,
      params,
    )

    return NextResponse.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('[Training Documents GET]', error)
    return NextResponse.json({ success: false, error: 'Không thể tải tài liệu đào tạo.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireBearerAdminOrSuperMutation(request)
  if (!auth.ok) return auth.response

  try {
    await ensureTrainingDocumentsTable(pool)
    const body = await request.json()
    const title = String(body.title || '').trim()
    const documentUrl = String(body.document_url || body.documentUrl || '').trim()

    if (!title) {
      return NextResponse.json({ success: false, error: 'Tiêu đề tài liệu là bắt buộc.' }, { status: 400 })
    }
    if (!documentUrl || !isHttpUrl(documentUrl)) {
      return NextResponse.json({ success: false, error: 'Link tài liệu phải là URL hợp lệ.' }, { status: 400 })
    }

    const result = await pool.query(
      `INSERT INTO hr_training_documents
       (title, description, document_url, stage, session_number, sort_order, status, created_by_email, updated_by_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       RETURNING id, title, description, document_url, stage, session_number, sort_order, status, created_at, updated_at`,
      [
        title,
        String(body.description || '').trim() || null,
        documentUrl,
        normalizeTrainingDocumentStage(body.stage),
        toNumberOrNull(body.session_number ?? body.sessionNumber),
        toSortOrder(body.sort_order ?? body.sortOrder),
        normalizeTrainingDocumentStatus(body.status),
        auth.sessionEmail,
      ],
    )

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[Training Documents POST]', error)
    return NextResponse.json({ success: false, error: 'Không thể tạo tài liệu đào tạo.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireBearerAdminOrSuperMutation(request)
  if (!auth.ok) return auth.response

  try {
    await ensureTrainingDocumentsTable(pool)
    const body = await request.json()
    const id = Number(body.id)
    const title = String(body.title || '').trim()
    const documentUrl = String(body.document_url || body.documentUrl || '').trim()

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ success: false, error: 'ID tài liệu không hợp lệ.' }, { status: 400 })
    }
    if (!title) {
      return NextResponse.json({ success: false, error: 'Tiêu đề tài liệu là bắt buộc.' }, { status: 400 })
    }
    if (!documentUrl || !isHttpUrl(documentUrl)) {
      return NextResponse.json({ success: false, error: 'Link tài liệu phải là URL hợp lệ.' }, { status: 400 })
    }

    const result = await pool.query(
      `UPDATE hr_training_documents
       SET title = $1,
           description = $2,
           document_url = $3,
           stage = $4,
           session_number = $5,
           sort_order = $6,
           status = $7,
           updated_by_email = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING id, title, description, document_url, stage, session_number, sort_order, status, created_at, updated_at`,
      [
        title,
        String(body.description || '').trim() || null,
        documentUrl,
        normalizeTrainingDocumentStage(body.stage),
        toNumberOrNull(body.session_number ?? body.sessionNumber),
        toSortOrder(body.sort_order ?? body.sortOrder),
        normalizeTrainingDocumentStatus(body.status),
        auth.sessionEmail,
        id,
      ],
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy tài liệu.' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('[Training Documents PATCH]', error)
    return NextResponse.json({ success: false, error: 'Không thể cập nhật tài liệu đào tạo.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireBearerAdminOrSuperMutation(request)
  if (!auth.ok) return auth.response

  try {
    await ensureTrainingDocumentsTable(pool)
    const id = Number(request.nextUrl.searchParams.get('id'))
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ success: false, error: 'ID tài liệu không hợp lệ.' }, { status: 400 })
    }

    await pool.query('DELETE FROM hr_training_documents WHERE id = $1', [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Training Documents DELETE]', error)
    return NextResponse.json({ success: false, error: 'Không thể xóa tài liệu đào tạo.' }, { status: 500 })
  }
}
