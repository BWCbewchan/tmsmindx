import { requireSameOriginMutation } from '@/lib/api-security';
import {
  TPS_SESSION_COOKIE,
  verifySessionCookieValue,
  type VerifiedEdgeSession,
} from '@/lib/session-cookie';
import { NextRequest, NextResponse } from 'next/server';

export type CandidateSessionResult =
  | { ok: true; candidateId: number; session: VerifiedEdgeSession }
  | { ok: false; response: NextResponse };

function candidateIdFromEmail(email: string): number | null {
  const match = email.match(/^candidate-(\d+)@candidate\.local$/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function requireCandidateSession(
  request: NextRequest,
): Promise<CandidateSessionResult> {
  const originDenied = requireSameOriginMutation(request);
  if (originDenied) return { ok: false, response: originDenied };

  const raw = request.cookies.get(TPS_SESSION_COOKIE)?.value;
  const session = raw ? await verifySessionCookieValue(raw) : null;
  const candidateId = session?.candidateId ?? (session?.email ? candidateIdFromEmail(session.email) : null);

  if (!session || session.role !== 'candidate' || !candidateId) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Yeu cau dang nhap ung vien hop le' },
        { status: 401 },
      ),
    };
  }

  return { ok: true, candidateId, session };
}

export function rejectCandidateIdMismatch(
  sessionCandidateId: number,
  requestedCandidateId: unknown,
): NextResponse | null {
  const id = Number(requestedCandidateId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { success: false, error: 'candidate_id khong hop le' },
      { status: 400 },
    );
  }

  if (id !== sessionCandidateId) {
    return NextResponse.json(
      { success: false, error: 'Khong co quyen truy cap du lieu ung vien nay' },
      { status: 403 },
    );
  }

  return null;
}

