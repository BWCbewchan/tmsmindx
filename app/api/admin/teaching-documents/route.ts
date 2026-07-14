import { requireBearerSuperAdmin } from '@/lib/auth-server'
import { clientIpFromRequest, rateLimitOr429 } from '@/lib/rate-limit-memory'
import {
  TEACHING_DOCUMENT_BUCKET,
  classifyTeachingDocument,
  createTeachingDocumentRecord,
  ensureTeachingDocumentBucket,
  isTeachingDocumentFolder,
  isTeachingDocumentStatus,
  isTeachingDocumentLevel,
  listTeachingDocuments,
  sanitizeFileStem,
  updateTeachingDocumentFolder,
  uploadTeachingDocumentObject,
} from '@/lib/teaching-documents'
import { isSupabaseS3Configured } from '@/lib/supabase-s3'
import { NextRequest, NextResponse } from 'next/server'

const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'pptx', 'png', 'jpg', 'jpeg', 'webp'])

export async function GET(request: NextRequest) {
  const gate = await requireBearerSuperAdmin(request)
  if (!gate.ok) return gate.response

  try {
    const documents = await listTeachingDocuments()
    return NextResponse.json({ success: true, documents })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Không thể tải danh sách tài liệu' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireBearerSuperAdmin(request)
  if (!gate.ok) return gate.response

  const rl = rateLimitOr429(`teaching-doc-upload:${clientIpFromRequest(request)}`, 10, 60_000)
  if (rl) return rl

  try {
    const formData = await request.formData()
    const sourceType = String(formData.get('source_type') || 'file').trim()
    const file = formData.get('file')
    const title = String(formData.get('title') || '').trim()
    const description = String(formData.get('description') || '').trim()
    const subjectName = String(formData.get('subject_name') || '').trim()
    const courseName = String(formData.get('course_name') || '').trim()
    const documentLevel = String(formData.get('document_level') || '').trim()
    const folderName = String(formData.get('folder_name') || '').trim()
    const lessonNumber = String(formData.get('lesson_number') || '').trim()
    const documentStatus = String(formData.get('document_status') || 'published').trim()
    const materialUrl = String(formData.get('material_url') || '').trim()
    const isMaterialLink = sourceType === 'material_link'

    if (!title || !subjectName || !documentLevel || !folderName || !lessonNumber) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập đầy đủ tiêu đề, bộ môn, thư mục, level và buổi học' },
        { status: 400 },
      )
    }

    if (!isTeachingDocumentLevel(documentLevel)) {
      return NextResponse.json({ success: false, error: 'Level tài liệu không hợp lệ' }, { status: 400 })
    }

    if (!isTeachingDocumentStatus(documentStatus)) {
      return NextResponse.json({ success: false, error: 'Trạng thái tài liệu không hợp lệ' }, { status: 400 })
    }

    if (!isTeachingDocumentFolder(folderName)) {
      return NextResponse.json({ success: false, error: 'Thư mục tài liệu không hợp lệ' }, { status: 400 })
    }

    if (!['file', 'material_link'].includes(sourceType)) {
      return NextResponse.json({ success: false, error: 'Loại tài liệu không hợp lệ' }, { status: 400 })
    }

    if (isMaterialLink) {
      let parsedUrl: URL
      try {
        parsedUrl = new URL(materialUrl)
      } catch {
        return NextResponse.json({ success: false, error: 'Link Material không hợp lệ' }, { status: 400 })
      }
      if (parsedUrl.protocol !== 'https:') {
        return NextResponse.json({ success: false, error: 'Link Material phải sử dụng HTTPS' }, { status: 400 })
      }

      const document = await createTeachingDocumentRecord({
        title,
        description: description || null,
        s3Key: '',
        fileName: parsedUrl.hostname,
        fileSize: 0,
        fileType: 'text/uri-list',
        subjectName,
        courseName: courseName || null,
        documentLevel,
        folderName: 'Material',
        lessonNumber,
        documentStatus,
        sourceType: 'material_link',
        materialUrl: parsedUrl.toString(),
        createdByEmail: gate.sessionEmail,
      })

      return NextResponse.json({ success: true, document })
    }

    if (!isSupabaseS3Configured()) {
      return NextResponse.json(
        { success: false, error: 'Chưa cấu hình Supabase S3 Storage' },
        { status: 500 },
      )
    }

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'Vui lòng chọn file tài liệu' }, { status: 400 })
    }

    if (file.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json({ success: false, error: 'File vượt quá dung lượng tối đa 100MB' }, { status: 400 })
    }

    const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { success: false, error: 'Chỉ hỗ trợ PDF, DOCX, PPTX, PNG, JPG/JPEG và WEBP' },
        { status: 400 },
      )
    }

    const kind = classifyTeachingDocument(file.type || '', file.name)
    if (kind === 'file') {
      return NextResponse.json({ success: false, error: 'Định dạng tài liệu chưa được hỗ trợ' }, { status: 400 })
    }

    await ensureTeachingDocumentBucket()
    const datePrefix = new Date().toISOString().slice(0, 10)
    const key = `secure-teaching/${sanitizeFileStem(subjectName)}/${sanitizeFileStem(courseName || 'other')}/${sanitizeFileStem(folderName)}/${datePrefix}/${Date.now()}-${sanitizeFileStem(file.name)}.${extension}`
    await uploadTeachingDocumentObject(file, key)

    const document = await createTeachingDocumentRecord({
      title,
      description: description || null,
      s3Key: key,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
      subjectName,
      courseName: courseName || null,
      documentLevel,
      folderName,
      lessonNumber,
      documentStatus,
      sourceType: 'file',
      createdByEmail: gate.sessionEmail,
    })

    return NextResponse.json({
      success: true,
      document,
      storagePath: `s3://${TEACHING_DOCUMENT_BUCKET}/${key}`,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Không thể upload tài liệu giảng dạy' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requireBearerSuperAdmin(request)
  if (!gate.ok) return gate.response

  const rl = rateLimitOr429(`teaching-doc-move:${clientIpFromRequest(request)}`, 60, 60_000)
  if (rl) return rl

  try {
    const body = await request.json()
    const documentId = Number(body?.document_id)
    const folderName = String(body?.folder_name || '').trim()

    if (!Number.isInteger(documentId) || documentId <= 0) {
      return NextResponse.json({ success: false, error: 'Tài liệu không hợp lệ' }, { status: 400 })
    }

    if (!isTeachingDocumentFolder(folderName)) {
      return NextResponse.json({ success: false, error: 'Thư mục tài liệu không hợp lệ' }, { status: 400 })
    }

    const document = await updateTeachingDocumentFolder(documentId, folderName)
    if (!document) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy tài liệu' }, { status: 404 })
    }

    return NextResponse.json({ success: true, document })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Không thể di chuyển tài liệu' },
      { status: 500 },
    )
  }
}
