import { requireBearerSession } from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET: Lấy danh sách thông báo của user
export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const email = auth.sessionEmail.trim().toLowerCase();
    const limit = Math.min(100, parseInt(request.nextUrl.searchParams.get('limit') || '50', 10));
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);

    let client;
    try {
      client = await pool.connect();
      const result = await client.query(
        `SELECT id, title, content, type, link, is_read, created_at, read_at
         FROM notifications
         WHERE recipient_email = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [email, limit, offset]
      );
      
      return NextResponse.json({
        success: true,
        data: result.rows,
      });
    } finally {
      client?.release();
    }
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// PATCH: Đánh dấu đã đọc
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const email = auth.sessionEmail.trim().toLowerCase();
    const body = await request.json();
    const { id, all = false } = body;

    let client;
    try {
      client = await pool.connect();
      if (all) {
        // Đánh dấu tất cả là đã đọc
        await client.query(
          `UPDATE notifications
           SET is_read = TRUE, read_at = NOW()
           WHERE recipient_email = $1 AND is_read = FALSE`,
          [email]
        );
      } else if (id) {
        // Đánh dấu một thông báo cụ thể là đã đọc
        await client.query(
          `UPDATE notifications
           SET is_read = TRUE, read_at = NOW()
           WHERE id = $1 AND recipient_email = $2`,
          [id, email]
        );
      } else {
        return NextResponse.json({ success: false, error: 'Cần cung cấp id hoặc all=true' }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: 'Updated successfully' });
    } finally {
      client?.release();
    }
  } catch (error) {
    console.error('Error updating notifications:', error);
    return NextResponse.json({ success: false, error: 'Failed to update notifications' }, { status: 500 });
  }
}
