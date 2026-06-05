import { jwtVerify } from 'jose';
import type { NextResponse } from 'next/server';

import { getJwtSecret } from '@/lib/jwt-secret';
import { normalizeAuthenticatedEmail } from '@/lib/security-identity';

/** Tên cookie phiên (HttpOnly, set từ API login). */
export const TPS_SESSION_COOKIE = 'tps_session';

/**
 * JWT HS256 do server ký (login app hoặc phiên edge sau Firebase).
 * Middleware chỉ tin chữ ký — không gọi DB.
 */
export type VerifiedEdgeSession = {
  email: string;
  /** Có quyền vào /admin và /api/admin (theo DB/permissions lúc đăng nhập). */
  canAdminPortal: boolean;
  role?: string;
  userId?: number;
  candidateId?: number;
};

export async function verifySessionCookieValue(
  token: string,
): Promise<VerifiedEdgeSession | null> {
  const raw = token.trim();
  if (!raw) return null;

  try {
    const { payload } = await jwtVerify(
      raw,
      new TextEncoder().encode(getJwtSecret()),
      { algorithms: ['HS256'] },
    );
    const email = normalizeAuthenticatedEmail(payload.email);
    if (!email) return null;
    const role = typeof payload.role === 'string' ? payload.role : undefined;
    const userId = Number(payload.userId);
    const candidateId = Number(payload.candidateId);
    const ap =
      payload.ap === true ||
      payload.ap === 'true' ||
      (typeof role === 'string' &&
        ['super_admin', 'admin', 'manager'].includes(role));
    return {
      email,
      canAdminPortal: Boolean(ap),
      role,
      ...(Number.isInteger(userId) && userId > 0 ? { userId } : {}),
      ...(Number.isInteger(candidateId) && candidateId > 0 ? { candidateId } : {}),
    };
  } catch {
    return null;
  }
}

export function setSessionCookieOnResponse(
  res: NextResponse,
  tokenValue: string,
  maxAgeSeconds = 60 * 60 * 24 * 30, // 30 ngày
) {
  res.cookies.set(TPS_SESSION_COOKIE, tokenValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  });
}

