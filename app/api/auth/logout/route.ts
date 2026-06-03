import { TPS_SESSION_COOKIE } from '@/lib/session-cookie';
import { requireSameOriginMutation } from '@/lib/api-security';
import { NextRequest, NextResponse } from 'next/server';

/** Xóa cookie phiên edge. JWT app/Firebase vẫn do client quản lý — hết hạn theo exp claim (và refresh Firebase có giới hạn revoke phía Google). */
export async function POST(request: NextRequest) {
  const originDenied = requireSameOriginMutation(request);
  if (originDenied) return originDenied;

  const res = NextResponse.json({ success: true });
  for (const name of [TPS_SESSION_COOKIE, 'lms_firebase_token', 'lms_firebase_refresh']) {
    res.cookies.set(name, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
  return res;
}
