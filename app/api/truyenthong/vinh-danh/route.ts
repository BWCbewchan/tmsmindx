import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { createSupabaseS3Client, deleteObject, isSupabaseS3Configured, parsePublicUrl } from '@/lib/supabase-s3'
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3'

export const dynamic = 'force-dynamic'

const HONORS_BUCKET_NAME = 'mindx-avatars'
const HONORS_KEY_PREFIX = 'honors-monthly/'
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

/** Xóa ảnh vinh danh khỏi S3 — chỉ xóa file có prefix honors-monthly/ */
async function deleteHonorsAvatarIfOwned(avatarUrl: string | null): Promise<void> {
  if (!avatarUrl || !isSupabaseS3Configured()) return
  try {
    const parsed = parsePublicUrl(avatarUrl)
    if (!parsed) return
    if (parsed.bucket !== HONORS_BUCKET_NAME || !parsed.key.startsWith(HONORS_KEY_PREFIX)) return
    await deleteObject(parsed.bucket, parsed.key)
  } catch (e) {
    console.warn('⚠️ Không xóa được ảnh vinh danh:', e)
  }
}

async function ensureBucket() {
  const client = createSupabaseS3Client()
  try {
    await client.send(new HeadBucketCommand({ Bucket: HONORS_BUCKET_NAME }))
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: HONORS_BUCKET_NAME }))
  }
}

function makeProxyUrl(bucket: string, key: string): string {
  return `/api/storage-image?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`
}

async function uploadHonorsAvatar(imageFile: File, id: number): Promise<string> {
  if (!imageFile.type.startsWith('image/')) {
    throw new Error('Chỉ hỗ trợ file ảnh')
  }
  if (imageFile.size > MAX_IMAGE_BYTES) {
    throw new Error('Ảnh vượt quá 10MB')
  }

  const buffer = Buffer.from(await imageFile.arrayBuffer())

  if (!isSupabaseS3Configured()) {
    return `data:${imageFile.type};base64,${buffer.toString('base64')}`
  }

  await ensureBucket()
  const s3 = createSupabaseS3Client()
  const ext = imageFile.name.includes('.') ? imageFile.name.split('.').pop() : 'jpg'
  const key = `${HONORS_KEY_PREFIX}manual-${id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  await s3.send(new PutObjectCommand({
    Bucket: HONORS_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: imageFile.type || 'image/jpeg',
  }))
  return makeProxyUrl(HONORS_BUCKET_NAME, key)
}

// GET /api/truyenthong/vinh-danh?thang=06/2025
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const thang = searchParams.get('thang')

    const client = await pool.connect()
    try {
      // Tạo bảng nếu chưa tồn tại (chạy migration lần đầu)
      await client.query(`
        CREATE TABLE IF NOT EXISTS teacher_monthly_honors (
          id SERIAL PRIMARY KEY,
          stt INTEGER,
          full_name VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          khoi_day VARCHAR(100),
          co_so VARCHAR(255),
          thang VARCHAR(20) NOT NULL,
          so_case INTEGER DEFAULT 0,
          so_hoc_sinh INTEGER DEFAULT 0,
          ti_le NUMERIC(5,2) DEFAULT 0,
          loai VARCHAR(100),
          thuong_cr NUMERIC(15,2) DEFAULT 0,
          avatar_url TEXT,
          imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          imported_by VARCHAR(255),
          UNIQUE(email, thang)
        );
        CREATE INDEX IF NOT EXISTS idx_teacher_monthly_honors_thang
          ON teacher_monthly_honors(thang, stt ASC);
        CREATE INDEX IF NOT EXISTS idx_teacher_monthly_honors_email
          ON teacher_monthly_honors(email);
        ALTER TABLE teacher_monthly_honors ADD COLUMN IF NOT EXISTS slogan VARCHAR(255);
        ALTER TABLE teacher_monthly_honors ADD COLUMN IF NOT EXISTS honors_avatar_url TEXT;
      `)

      // Lấy danh sách các tháng đã có dữ liệu
      const monthsRes = await client.query(`
        SELECT thang
        FROM teacher_monthly_honors
        GROUP BY thang
        ORDER BY MAX(imported_at) DESC NULLS LAST, thang DESC
      `)
      const months: string[] = monthsRes.rows.map((r: { thang: string }) => r.thang)

      if (!thang && !months.length) {
        return jsonNoStore({ success: true, months: [], data: [] })
      }

      const targetMonth = thang || months[0]

      const dataRes = await client.query(`
        SELECT
          id, stt, full_name, email, khoi_day, co_so, thang,
          so_case, so_hoc_sinh,
          CAST(ti_le AS FLOAT) AS ti_le,
          loai, thuong_cr, COALESCE(honors_avatar_url, avatar_url) AS avatar_url, slogan, imported_at
        FROM teacher_monthly_honors
        WHERE thang = $1
        ORDER BY stt ASC NULLS LAST, ti_le DESC
      `, [targetMonth])

      return jsonNoStore({
        success: true,
        months,
        current_month: targetMonth,
        data: dataRes.rows,
      })
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('Get vinh danh error:', err)
    return jsonNoStore({ success: false, error: 'Lỗi server' }, { status: 500 })
  }
}

// DELETE /api/truyenthong/vinh-danh?thang=06/2025
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const thang = searchParams.get('thang')
    if (!thang) return NextResponse.json({ success: false, error: 'Thiếu tháng' }, { status: 400 })

    const client = await pool.connect()
    try {
      // Đảm bảo cột honors_avatar_url tồn tại (migration an toàn)
      await client.query(`
        ALTER TABLE teacher_monthly_honors ADD COLUMN IF NOT EXISTS honors_avatar_url TEXT
      `)

      // Lấy danh sách honors_avatar_url của tháng này trước khi xóa
      const avatarRows = await client.query(
        `SELECT honors_avatar_url FROM teacher_monthly_honors
         WHERE thang = $1 AND honors_avatar_url IS NOT NULL`,
        [thang]
      )

      // Xóa DB rows
      const res = await client.query(
        `DELETE FROM teacher_monthly_honors WHERE thang = $1`,
        [thang]
      )

      // Xóa ảnh vinh danh trên S3 (sau khi DB đã xóa an toàn)
      const deleteResults = await Promise.allSettled(
        avatarRows.rows.map((r: { honors_avatar_url: string }) =>
          deleteHonorsAvatarIfOwned(r.honors_avatar_url)
        )
      )
      const s3Deleted = deleteResults.filter(r => r.status === 'fulfilled').length

      return NextResponse.json({
        success: true,
        deleted: res.rowCount,
        s3_deleted: s3Deleted,
      })
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('DELETE vinh-danh error:', err)
    return NextResponse.json({ success: false, error: 'Lỗi server' }, { status: 500 })
  }
}

// PATCH /api/truyenthong/vinh-danh — cập nhật nội dung hoặc avatar vinh danh cho 1 record
export async function PATCH(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    const isMultipart = contentType.includes('multipart/form-data')
    const body = isMultipart ? null : await request.json()
    const formData = isMultipart ? await request.formData() : null

    const id = Number(isMultipart ? formData?.get('id') : body?.id)
    const slogan = isMultipart ? formData?.get('slogan') : body?.slogan
    const full_name = isMultipart ? formData?.get('full_name') : body?.full_name
    const co_so = isMultipart ? formData?.get('co_so') : body?.co_so
    const ti_le = isMultipart ? formData?.get('ti_le') : body?.ti_le
    const avatarFile = isMultipart ? formData?.get('avatar') : null

    if (!id) return NextResponse.json({ success: false, error: 'Thiếu id' }, { status: 400 })

    const sets: string[] = []
    const vals: unknown[] = []
    let idx = 1

    const client = await pool.connect()
    try {
      await client.query(`
        ALTER TABLE teacher_monthly_honors ADD COLUMN IF NOT EXISTS honors_avatar_url TEXT;
        ALTER TABLE teacher_monthly_honors ADD COLUMN IF NOT EXISTS slogan VARCHAR(255);
      `)

      let oldHonorsAvatarUrl: string | null = null
      if (avatarFile && typeof avatarFile !== 'string') {
        const oldRes = await client.query(
          `SELECT honors_avatar_url FROM teacher_monthly_honors WHERE id = $1 LIMIT 1`,
          [id]
        )
        oldHonorsAvatarUrl = oldRes.rows[0]?.honors_avatar_url || null
        const avatarUrl = await uploadHonorsAvatar(avatarFile, id)
        sets.push(`honors_avatar_url = $${idx++}`)
        vals.push(avatarUrl)
        sets.push(`avatar_url = $${idx++}`)
        vals.push(avatarUrl)
      }

      if (slogan !== undefined && typeof slogan === 'string')       { sets.push(`slogan = $${idx++}`);    vals.push(slogan || null) }
      if (full_name !== undefined && typeof full_name === 'string') { sets.push(`full_name = $${idx++}`); vals.push(full_name) }
      if (co_so !== undefined && typeof co_so === 'string')         { sets.push(`co_so = $${idx++}`);     vals.push(co_so || null) }
      if (ti_le !== undefined) {
        const parsedPercent = Number(String(ti_le).replace(/%/g, '').replace(',', '.').trim())
        if (!Number.isFinite(parsedPercent)) {
          return NextResponse.json({ success: false, error: 'CR45 không hợp lệ' }, { status: 400 })
        }
        sets.push(`ti_le = $${idx++}`)
        vals.push(parsedPercent)
      }
      if (!sets.length) return NextResponse.json({ success: false, error: 'Không có gì để cập nhật' }, { status: 400 })

      vals.push(id)
      await client.query(
        `UPDATE teacher_monthly_honors SET ${sets.join(', ')} WHERE id = $${idx}`,
        vals
      )
      await deleteHonorsAvatarIfOwned(oldHonorsAvatarUrl)
      return NextResponse.json({ success: true })
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('PATCH vinh-danh error:', err)
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Lỗi server',
    }, { status: 500 })
  }
}
