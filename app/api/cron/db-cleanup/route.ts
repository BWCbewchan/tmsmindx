import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getApiSecret } from '@/lib/internal-api-secret';

/**
 * Cron job: Dọn dẹp dữ liệu cũ để giữ hiệu năng DB
 * - session_tracking: Xóa sessions không hoạt động > 24h
 * - security_audit_logs: Archive logs > 90 ngày (chuyển sang bảng lưu trữ)
 * - ai_rate_limits: Xóa rate limit records đã hết hạn > 7 ngày
 * 
 * Schedule: Mỗi ngày lúc 2:00 AM (UTC)
 * Vercel cron: "0 2 * * *"
 */
export async function GET(request: NextRequest) {
  // Bảo vệ endpoint - chỉ Vercel Cron hoặc internal call mới được gọi
  const authHeader = request.headers.get('authorization');
  const apiSecret = getApiSecret();
  
  const isCronRequest = authHeader === `Bearer ${apiSecret}`;
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  
  if (!isCronRequest && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, number | string> = {};

  try {
    // 1. Dọn session_tracking cũ hơn 24h
    const sessionCleanup = await pool.query(
      `DELETE FROM public.session_tracking 
       WHERE last_activity < NOW() - INTERVAL '24 hours'
       RETURNING id`
    );
    results.session_tracking_deleted = sessionCleanup.rowCount ?? 0;

    // 2. Dọn ai_rate_limits đã hết hạn > 7 ngày
    const rateLimitCleanup = await pool.query(
      `DELETE FROM public.ai_rate_limits 
       WHERE reset_at < NOW() - INTERVAL '7 days'
       RETURNING id`
    );
    results.ai_rate_limits_deleted = rateLimitCleanup.rowCount ?? 0;

    // 3. Dọn ai_analysis_cache đã hết hạn
    const cacheCleanup = await pool.query(
      `DELETE FROM public.ai_analysis_cache 
       WHERE expires_at < NOW()
       RETURNING id`
    );
    results.ai_cache_deleted = cacheCleanup.rowCount ?? 0;

    // 4. Thống kê audit log (không xóa, chỉ báo cáo)
    const auditCount = await pool.query(
      `SELECT COUNT(*) as total, 
              COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as last_7_days
       FROM public.security_audit_logs`
    );
    results.audit_log_total = auditCount.rows[0]?.total ?? 0;
    results.audit_log_last_7d = auditCount.rows[0]?.last_7_days ?? 0;

    console.log('[Cron: DB Cleanup] Results:', results);

    return NextResponse.json({
      success: true,
      ran_at: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error('[Cron: DB Cleanup] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Cleanup failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
