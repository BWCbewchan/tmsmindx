import { requireBearerSession } from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET: Lay danh sach thong bao cua user hien tai.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const email = auth.sessionEmail.trim().toLowerCase();
    const requestedLimit = Number.parseInt(
      request.nextUrl.searchParams.get('limit') || '50',
      10
    );
    const requestedOffset = Number.parseInt(
      request.nextUrl.searchParams.get('offset') || '0',
      10
    );
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(100, Math.max(1, requestedLimit))
      : 50;
    const offset = Number.isFinite(requestedOffset)
      ? Math.max(0, requestedOffset)
      : 0;

    let client;
    try {
      client = await pool.connect();
      const result = await client.query(
        `SELECT id, title, content, type, link, is_read, created_at, read_at,
                COUNT(*) OVER()::int AS total_count
         FROM notifications
         WHERE recipient_email = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [email, limit, offset]
      );

      const total = result.rows[0]?.total_count || 0;
      const rows = result.rows.map((row) => {
        const notification = { ...row };
        delete notification.total_count;
        return notification;
      });

      return NextResponse.json({
        success: true,
        data: rows,
        total,
        limit,
        offset,
      });
    } finally {
      client?.release();
    }
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// PATCH: Danh dau da doc / chua doc. Tat ca thao tac deu khoa theo email trong session.
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const email = auth.sessionEmail.trim().toLowerCase();
    const body = await request.json();
    const { id, all = false } = body;
    const targetIsRead = body.is_read !== false;

    let client;
    try {
      client = await pool.connect();

      if (all) {
        const result = await client.query(
          `UPDATE notifications
           SET is_read = $2, read_at = CASE WHEN $2 THEN NOW() ELSE NULL END
           WHERE recipient_email = $1 AND is_read IS DISTINCT FROM $2`,
          [email, targetIsRead]
        );

        return NextResponse.json({
          success: true,
          message: 'Updated successfully',
          updated_count: result.rowCount || 0,
        });
      }

      const notificationId = Number(id);
      if (!Number.isInteger(notificationId) || notificationId <= 0) {
        return NextResponse.json(
          { success: false, error: 'Cần cung cấp id hợp lệ hoặc all=true' },
          { status: 400 }
        );
      }

      const result = await client.query(
        `UPDATE notifications
         SET is_read = $3, read_at = CASE WHEN $3 THEN NOW() ELSE NULL END
         WHERE id = $1 AND recipient_email = $2`,
        [notificationId, email, targetIsRead]
      );

      if ((result.rowCount || 0) === 0) {
        return NextResponse.json(
          { success: false, error: 'Notification not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, message: 'Updated successfully' });
    } finally {
      client?.release();
    }
  } catch (error) {
    console.error('Error updating notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}

// DELETE: Xoa mot thong bao cua user hien tai.
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const email = auth.sessionEmail.trim().toLowerCase();
    let rawId: unknown = request.nextUrl.searchParams.get('id');

    if (!rawId) {
      try {
        const body = await request.json();
        rawId = body?.id;
      } catch {
        rawId = null;
      }
    }

    const notificationId = Number(rawId);
    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Cần cung cấp id hợp lệ' },
        { status: 400 }
      );
    }

    let client;
    try {
      client = await pool.connect();
      const result = await client.query(
        `DELETE FROM notifications
         WHERE id = $1 AND recipient_email = $2
         RETURNING id`,
        [notificationId, email]
      );

      if ((result.rowCount || 0) === 0) {
        return NextResponse.json(
          { success: false, error: 'Notification not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, message: 'Deleted successfully' });
    } finally {
      client?.release();
    }
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}
