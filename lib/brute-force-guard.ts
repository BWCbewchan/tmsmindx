/**
 * brute-force-guard.ts
 * ─────────────────────────────────────────────────────────────
 * Phát hiện và tự động block IP thực hiện brute force.
 * Dùng stored procedure increment_threat_count() trên DB.
 * ─────────────────────────────────────────────────────────────
 */

import pool from '@/lib/db';

export interface ThreatCheckResult {
  blocked:      boolean;
  attemptCount: number;
  blockedUntil?: Date;
  message?:     string;
}

// Cấu hình ngưỡng cho từng loại threat
const THREAT_CONFIG = {
  LOGIN_FAIL:     { max: 5,  windowMin: 5,  blockMin: 30  },
  UNAUTHORIZED:   { max: 10, windowMin: 10, blockMin: 60  },
  SUSPICIOUS_API: { max: 20, windowMin: 5,  blockMin: 120 },
} as const;

export type ThreatType = keyof typeof THREAT_CONFIG;

/**
 * Ghi nhận 1 attempt và kiểm tra có bị block không.
 * Tự động block và ghi audit log nếu vượt ngưỡng.
 */
export async function checkAndRecordThreat(
  ip:          string,
  threatType:  ThreatType
): Promise<ThreatCheckResult> {
  const cfg = THREAT_CONFIG[threatType];

  try {
    const result = await pool.query<{
      is_blocked:    boolean;
      attempt_count: number;
      blocked_until: string | null;
    }>(
      `SELECT * FROM public.increment_threat_count($1, $2, $3, $4, $5)`,
      [ip, threatType, cfg.windowMin, cfg.max, cfg.blockMin]
    );

    const row = result.rows[0];
    if (!row) return { blocked: false, attemptCount: 1 };

    if (row.is_blocked) {
      return {
        blocked:      true,
        attemptCount: row.attempt_count,
        blockedUntil: row.blocked_until ? new Date(row.blocked_until) : undefined,
        message:      `IP bị block đến ${row.blocked_until ? new Date(row.blocked_until).toLocaleString('vi-VN') : 'không xác định'}`,
      };
    }

    return { blocked: false, attemptCount: row.attempt_count };
  } catch (err) {
    console.error('[BruteForceGuard] Error:', (err as Error).message);
    return { blocked: false, attemptCount: 0 };
  }
}

/**
 * Kiểm tra IP có đang bị block không (không tăng count).
 */
export async function isIpBlocked(ip: string): Promise<{
  blocked: boolean;
  blockedUntil?: Date;
  threatType?: string;
}> {
  try {
    const result = await pool.query<{
      threat_type:  string;
      blocked_until: string;
    }>(
      `SELECT threat_type, blocked_until
       FROM public.security_threat_tracking
       WHERE ip_address  = $1
         AND is_blocked  = true
         AND blocked_until > NOW()
       ORDER BY blocked_until DESC
       LIMIT 1`,
      [ip]
    );

    const row = result.rows[0];
    if (row) {
      return {
        blocked:      true,
        blockedUntil: new Date(row.blocked_until),
        threatType:   row.threat_type,
      };
    }

    return { blocked: false };
  } catch (err) {
    console.error('[BruteForceGuard] isIpBlocked error:', (err as Error).message);
    return { blocked: false };
  }
}

/**
 * Xóa block cho một IP (admin action).
 */
export async function unblockIp(ip: string): Promise<void> {
  await pool.query(
    `UPDATE public.security_threat_tracking
     SET is_blocked    = false,
         blocked_until = NULL,
         attempt_count = 0
     WHERE ip_address = $1`,
    [ip]
  );
}

/**
 * Khóa một IP thủ công (admin action).
 */
export async function blockIp(ip: string): Promise<void> {
  await pool.query(
    `INSERT INTO public.security_threat_tracking (ip_address, threat_type, attempt_count, is_blocked, blocked_until, notes)
     VALUES ($1, 'MANUAL_BLOCK', 1, true, NOW() + INTERVAL '24 hours', 'Blocked manually by admin via Telegram bot')
     ON CONFLICT (ip_address, threat_type) DO UPDATE
     SET is_blocked = true, 
         blocked_until = NOW() + INTERVAL '24 hours', 
         attempt_count = security_threat_tracking.attempt_count + 1`,
    [ip]
  );
}
