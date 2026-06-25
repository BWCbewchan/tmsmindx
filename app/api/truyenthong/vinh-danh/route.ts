import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { deleteObject, isSupabaseS3Configured, parsePublicUrl } from '@/lib/supabase-s3'

const HONORS_KEY_PREFIX = 'honors-monthly/'

/** Xóa ảnh vinh danh khỏi S3 — chỉ xóa file có prefix honors-monthly/ */
async function deleteHonorsAvatarIfOwned(avatarUrl: string | null): Promise<void> {
  if (!avatarUrl || !isSupabaseS3Configured()) return
  try {
    const parsed = parsePublicUrl(avatarUrl)
    if (!parsed) return
    if (!parsed.key.startsWith(HONORS_KEY_PREFIX)) return
    await deleteObject(parsed.bucket, parsed.key)
  } catch (e) {
    console.warn('⚠️ Không xóa được ảnh vinh danh:', e)
  }
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
      `)

      // Lấy danh sách các tháng đã có dữ liệu
      const monthsRes = await client.query(`
        SELECT DISTINCT thang FROM teacher_monthly_honors
        ORDER BY thang DESC
      `)
      const months: string[] = monthsRes.rows.map((r: { thang: string }) => r.thang)

      if (!thang && !months.length) {
        return NextResponse.json({ success: true, months: [], data: [] })
      }

      const targetMonth = thang || months[0]

      const dataRes = await client.query(`
        SELECT
          id, stt, full_name, email, khoi_day, co_so, thang,
          so_case, so_hoc_sinh,
          CAST(ti_le AS FLOAT) AS ti_le,
          loai, thuong_cr, avatar_url, slogan, imported_at
        FROM teacher_monthly_honors
        WHERE thang = $1
        ORDER BY stt ASC NULLS LAST, ti_le DESC
      `, [targetMonth])

      return NextResponse.json({
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
    return NextResponse.json({ success: false, error: 'Lỗi server' }, { status: 500 })
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

// PATCH /api/truyenthong/vinh-danh — cập nhật slogan/full_name/co_so cho 1 record
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, slogan, full_name, co_so } = body as {
      id: number
      slogan?: string
      full_name?: string
      co_so?: string
    }
    if (!id) return NextResponse.json({ success: false, error: 'Thiếu id' }, { status: 400 })

    const sets: string[] = []
    const vals: unknown[] = []
    let idx = 1
    if (slogan !== undefined)    { sets.push(`slogan = $${idx++}`);    vals.push(slogan || null) }
    if (full_name !== undefined) { sets.push(`full_name = $${idx++}`); vals.push(full_name) }
    if (co_so !== undefined)     { sets.push(`co_so = $${idx++}`);     vals.push(co_so || null) }
    if (!sets.length) return NextResponse.json({ success: false, error: 'Không có gì để cập nhật' }, { status: 400 })

    vals.push(id)
    const client = await pool.connect()
    try {
      await client.query(
        `UPDATE teacher_monthly_honors SET ${sets.join(', ')} WHERE id = $${idx}`,
        vals
      )
      return NextResponse.json({ success: true })
    } finally {
      client.release()
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Lỗi server' }, { status: 500 })
  }
}
