import jwt from 'jsonwebtoken'
import pool from '@/lib/db'
import { getJwtSecret } from '@/lib/jwt-secret'
import { normalizeAuthenticatedEmail } from '@/lib/security-identity'

// ─── Firebase Token Cache ─────────────────────────────────────────────────────
// Cache Firebase token verification (in-memory, per serverless instance)
// Key: last 32 chars of token (không lưu raw token)
// Value: { email, expiresAt }
const _fbTokenCache = new Map<string, { email: string; expiresAt: number }>();

// Dọn cache tự động mỗi 30 phút để tránh memory leak
const _cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of _fbTokenCache.entries()) {
    if (now >= val.expiresAt) _fbTokenCache.delete(key);
  }
}, 30 * 60 * 1000);
// unref() để không block process exit trong môi trường Node.js
if (typeof _cleanupInterval?.unref === 'function') _cleanupInterval.unref();

// ─── Types ────────────────────────────────────────────────────────────────────

export type VerifiedSession = {
  email: string
  /** Chỉ có khi đăng nhập app (JWT nội bộ). */
  role?: string
}

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Xác thực Bearer: JWT app (HS256) hoặc Firebase ID token (Google tokeninfo).
 */
export async function verifyBearerGetSession(
  bearerToken: string,
): Promise<VerifiedSession | null> {
  const token = bearerToken.trim()
  if (!token) return null

  // 1. Thử verify JWT app nội bộ trước (không cần network)
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as {
      email?: string
      role?: string
    }
    const email = normalizeAuthenticatedEmail(decoded.email)
    if (email) {
      return { email, role: decoded.role }
    }
  } catch {
    // Không phải JWT app — thử Firebase
  }

  // 2. Firebase ID token — có cache để tránh gọi Google API liên tục
  const fbEmail = await verifyFirebaseIdTokenEmail(token)
  if (fbEmail) return { email: fbEmail }
  return null
}

/**
 * Xác thực Firebase ID token qua Google tokeninfo API.
 * Kết quả được cache trong memory theo thời gian hết hạn của token.
 */
async function verifyFirebaseIdTokenEmail(
  idToken: string,
): Promise<string | null> {
  // Dùng 32 ký tự cuối của token làm cache key (không lưu full token)
  const cacheKey = idToken.slice(-32);
  const now = Date.now();

  // Kiểm tra cache trước — không cần HTTP call nếu đã cache
  const cached = _fbTokenCache.get(cacheKey);
  if (cached && now < cached.expiresAt) {
    return cached.email;
  }

  try {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000), // Timeout 3s thay vì chờ mãi
    })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, unknown>
    const email = normalizeAuthenticatedEmail(data.email)

    // Cache kết quả cho đến khi token hết hạn (trừ 5 phút buffer an toàn)
    if (email && data.exp) {
      const tokenExpMs = Number(data.exp) * 1000;
      const safeExpMs  = tokenExpMs - (5 * 60 * 1000);
      if (safeExpMs > now) {
        _fbTokenCache.set(cacheKey, { email, expiresAt: safeExpMs });
      }
    }
    return email
  } catch {
    return null
  }
}

// ─── Permission Helpers ───────────────────────────────────────────────────────

/**
 * Admin / manager (hoặc quyền route /admin) mới tra cứu GV theo email/code tùy ý.
 */
export async function userCanLookupAnyTeacher(
  sessionEmail: string,
): Promise<boolean> {
  const normalized = sessionEmail.trim().toLowerCase()
  try {
    const dbResult = await pool.query(
      `SELECT id, role FROM app_users WHERE LOWER(email) = $1 AND is_active = true LIMIT 1`,
      [normalized],
    )
    if (dbResult.rows.length === 0) return false
    const appUser = dbResult.rows[0] as { id: number; role: string }
    if (['super_admin', 'admin', 'manager'].includes(appUser.role)) return true

    const roleCodesRes = await pool.query(
      `SELECT UPPER(role_code::text) AS code FROM user_roles WHERE user_id = $1`,
      [appUser.id],
    )
    const roleCodes = roleCodesRes.rows.map((r: { code: string }) => r.code)
    if (roleCodes.some((c) => c === 'HR' || c === 'TE' || c === 'TF')) return true

    const directPerms = await pool.query(
      `SELECT route_path FROM app_permissions WHERE user_id = $1 AND can_access = true`,
      [appUser.id],
    )
    const rolePerms = await pool.query(
      `SELECT DISTINCT rp.route_path
       FROM user_roles ur
       JOIN role_permissions rp ON rp.role_code = ur.role_code
       WHERE ur.user_id = $1`,
      [appUser.id],
    )
    const paths = [
      ...directPerms.rows.map((r: { route_path: string }) => r.route_path),
      ...rolePerms.rows.map((r: { route_path: string }) => r.route_path),
    ]
    return paths.some((p) => p.startsWith('/admin'))
  } catch {
    return false
  }
}

export function teacherRowWorkEmail(row: Record<string, unknown>): string {
  const a = row.work_email
  const b = row['Work email']
  return String(a ?? b ?? '')
    .trim()
    .toLowerCase()
}
