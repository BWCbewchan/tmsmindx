import { requireBearerSession } from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const email = auth.sessionEmail.trim().toLowerCase();
    
    let client;
    try {
      client = await pool.connect();
      const result = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM notifications
         WHERE recipient_email = $1 AND is_read = FALSE`,
        [email]
      );
      
      return NextResponse.json({
        success: true,
        count: result.rows[0].count,
      });
    } finally {
      client?.release();
    }
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch unread count' }, { status: 500 });
  }
}
