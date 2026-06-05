import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { isDatabaseUnavailableError } from '@/lib/db-helpers'
import { rejectIfEmailNotSelf, requireBearerSession } from '@/lib/datasource-api-auth'
import { withApiProtection } from '@/lib/api-protection'
import { createSupabaseS3Client, isSupabaseS3Configured } from '@/lib/supabase-s3'
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

export const dynamic = 'force-dynamic'

const BUCKET_NAME = 'teacher-certificates'

async function ensureBucket() {
    const client = createSupabaseS3Client()
    try {
        await client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }))
    } catch {
        await client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }))
    }
}

function makeProxyUrl(bucket: string, key: string): string {
    return `/api/storage-image?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`
}

// GET: Lấy danh sách chứng chỉ của giáo viên
async function handleGet(req: NextRequest) {
    try {
        const auth = await requireBearerSession(req)
        if (!auth.ok) return auth.response

        const searchParams = req.nextUrl.searchParams
        const teacherEmail = searchParams.get('email')

        if (!teacherEmail) {
            return NextResponse.json(
                { success: false, error: 'Teacher email is required' },
                { status: 400 }
            )
        }

        const denied = rejectIfEmailNotSelf(
            auth.sessionEmail,
            auth.privileged,
            teacherEmail.trim().toLowerCase(),
        )
        if (denied) return denied

        const result = await pool.query(
            `SELECT * FROM teacher_certificates 
             WHERE teacher_email = $1 
             ORDER BY created_at DESC`,
            [teacherEmail]
        )

        return NextResponse.json({
            success: true,
            data: result.rows,
            count: result.rows.length,
        })
    } catch (error) {
        if (isDatabaseUnavailableError(error)) {
            return NextResponse.json({
                success: true,
                data: [],
                count: 0,
                dbUnavailable: true,
            })
        }
        console.error('Error fetching certificates:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { success: false, error: 'Failed to fetch certificates', details: errorMessage },
            { status: 500 }
        )
    }
}

// POST: Thêm chứng chỉ mới (nhận multipart/form-data và upload lên S3)
async function handlePost(req: NextRequest) {
    try {
        const auth = await requireBearerSession(req)
        if (!auth.ok) return auth.response

        if (!isSupabaseS3Configured()) {
            return NextResponse.json(
                { success: false, error: 'Chưa cấu hình Supabase S3 Storage' },
                { status: 500 }
            )
        }

        const formData = await req.formData()
        const teacher_email = formData.get('teacher_email')
        const certificate_name = formData.get('certificate_name')
        const certificate_type = formData.get('certificate_type')
        const issue_date = formData.get('issue_date')
        const expiry_date = formData.get('expiry_date')
        const description = formData.get('description')
        const file = formData.get('file')

        // Validation
        if (!teacher_email || !certificate_name || !file || typeof file === 'string') {
            return NextResponse.json(
                { success: false, error: 'Required fields: teacher_email, certificate_name, file' },
                { status: 400 }
            )
        }

        const denied = rejectIfEmailNotSelf(
            auth.sessionEmail,
            auth.privileged,
            String(teacher_email).trim().toLowerCase(),
        )
        if (denied) return denied

        const validTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'application/pdf',
        ]
        if (!validTypes.includes(file.type)) {
            return NextResponse.json(
                { success: false, error: 'Chỉ hỗ trợ file ảnh (JPG, PNG, WEBP) hoặc PDF' },
                { status: 400 }
            )
        }

        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json(
                { success: false, error: 'Kích thước file tối đa 10MB' },
                { status: 400 }
            )
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        await ensureBucket()
        const client = createSupabaseS3Client()

        const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
        const safeEmail = String(teacher_email).replace(/[^a-zA-Z0-9._-]/g, '_')
        const key = `certificates/${safeEmail}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

        await client.send(
            new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
                Body: buffer,
                ContentType: file.type || 'image/jpeg',
            }),
        )

        const url = makeProxyUrl(BUCKET_NAME, key)

        const result = await pool.query(
            `INSERT INTO teacher_certificates 
             (teacher_email, certificate_name, certificate_url, certificate_type, 
              issue_date, expiry_date, description, cloudinary_public_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                teacher_email,
                certificate_name,
                url,
                certificate_type || null,
                issue_date || null,
                expiry_date || null,
                description || null,
                key, // Lưu S3 Key vào trường cloudinary_public_id để phục vụ xóa/quản lý
            ]
        )

        return NextResponse.json({
            success: true,
            message: 'Certificate added successfully',
            data: result.rows[0],
        })
    } catch (error) {
        if (isDatabaseUnavailableError(error)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Database tạm thời quá tải hoặc không kết nối được',
                    dbUnavailable: true,
                },
                { status: 503 }
            )
        }
        console.error('Error adding certificate:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { success: false, error: 'Failed to add certificate', details: errorMessage },
            { status: 500 }
        )
    }
}

// DELETE: Xóa chứng chỉ (đồng thời xóa file trên S3)
async function handleDelete(req: NextRequest) {
    try {
        const auth = await requireBearerSession(req)
        if (!auth.ok) return auth.response

        const searchParams = req.nextUrl.searchParams
        const certificateId = searchParams.get('id')
        const teacherEmail = searchParams.get('email')

        if (!certificateId || !teacherEmail) {
            return NextResponse.json(
                { success: false, error: 'Certificate ID and teacher email are required' },
                { status: 400 }
            )
        }

        const denied = rejectIfEmailNotSelf(
            auth.sessionEmail,
            auth.privileged,
            teacherEmail.trim().toLowerCase(),
        )
        if (denied) return denied

        // Lấy thông tin chứng chỉ để tìm S3 key trước khi xóa
        const check = await pool.query(
            `SELECT * FROM teacher_certificates 
             WHERE id = $1 AND teacher_email = $2`,
            [certificateId, teacherEmail]
        )

        if (check.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Certificate not found or unauthorized' },
                { status: 404 }
            )
        }

        const cert = check.rows[0]
        const s3Key = cert.cloudinary_public_id

        // Xóa file khỏi S3 nếu được cấu hình
        if (s3Key && s3Key.startsWith('certificates/') && isSupabaseS3Configured()) {
            const client = createSupabaseS3Client()
            try {
                await client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key }))
            } catch (s3Err) {
                console.error('Error deleting certificate from S3:', s3Err)
            }
        }

        // Xóa dòng dữ liệu trong DB
        const result = await pool.query(
            `DELETE FROM teacher_certificates 
             WHERE id = $1 AND teacher_email = $2
             RETURNING *`,
            [certificateId, teacherEmail]
        )

        return NextResponse.json({
            success: true,
            message: 'Certificate deleted successfully',
            data: result.rows[0],
        })
    } catch (error) {
        if (isDatabaseUnavailableError(error)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Database tạm thời quá tải hoặc không kết nối được',
                    dbUnavailable: true,
                },
                { status: 503 }
            )
        }
        console.error('Error deleting certificate:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { success: false, error: 'Failed to delete certificate', details: errorMessage },
            { status: 500 }
        )
    }
}

export const GET = withApiProtection(handleGet)
export const POST = withApiProtection(handlePost)
export const DELETE = withApiProtection(handleDelete)
