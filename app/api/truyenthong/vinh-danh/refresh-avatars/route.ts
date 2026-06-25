import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const thang = searchParams.get('thang')

    const client = await pool.connect()
    try {
      // Đảm bảo cột avatar_url tồn tại trên app_users (migration guard)
      await client.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS avatar_url TEXT`)

      const whereClause = thang ? 'WHERE tmh.thang = $1' : ''
      const params = thang ? [thang] : []

      const res = await client.query(`
        UPDATE teacher_monthly_honors tmh
        SET avatar_url = COALESCE(
          (SELECT ta.avatar_url FROM teacher_avatars ta
           WHERE LOWER(ta.teacher_email) = LOWER(tmh.email) LIMIT 1),
          (SELECT au.avatar_url FROM app_users au
           WHERE LOWER(au.email) = LOWER(tmh.email) LIMIT 1)
        )
        ${whereClause}
        RETURNING id, full_name, email, avatar_url
      `, params)

      const withAvatar = (res.rows as { avatar_url: string | null }[])
        .filter(r => r.avatar_url !== null).length

      return NextResponse.json({
        success: true,
        total: res.rowCount,
        withAvatar,
      })
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('Refresh avatars error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Lỗi server' },
      { status: 500 }
    )
  }
}
