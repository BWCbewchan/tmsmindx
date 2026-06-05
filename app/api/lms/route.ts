import { requireBearerSession } from '@/lib/datasource-api-auth';
import { callLmsApi } from '@/lib/lms-api';
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_ALLOWED_OPERATIONS = new Set([
  'GetTeacherByCode',
  'GetClasses',
  'GetAllClasses',
  'GetClassSessions',
]);

function allowedOperations(): Set<string> {
  const configured = process.env.LMS_ALLOWED_OPERATIONS?.trim();
  if (!configured) return DEFAULT_ALLOWED_OPERATIONS;
  return new Set(
    configured
      .split(/[,;\s]+/g)
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function operationNameFromQuery(query: unknown): string | null {
  if (typeof query !== 'string') return null;
  const match = query.match(/\b(query|mutation)\s+([A-Za-z0-9_]+)/);
  return match?.[2] || null;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireBearerSession(req);
    if (!auth.ok) return auth.response;

    const rl = await rateLimitOr429Async(
      `lms:${clientIpFromRequest(req)}`,
      120,
      60_000,
    );
    if (rl) return rl;

    const body = await req.json();
    const operationName = String(
      body?.operationName || operationNameFromQuery(body?.query) || '',
    ).trim();

    if (!operationName || !allowedOperations().has(operationName)) {
      return NextResponse.json(
        { errors: [{ message: 'LMS operation khong duoc phep' }] },
        { status: 403 },
      );
    }

    const firebaseToken = req.cookies.get('lms_firebase_token')?.value;
    if (!firebaseToken) {
      return NextResponse.json(
        { errors: [{ message: 'Phien dang nhap khong co token LMS' }] },
        { status: 401 },
      );
    }

    const data = await callLmsApi(body, `Bearer ${firebaseToken}`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('LMS Proxy Error:', error?.message || error);
    return NextResponse.json(
      { errors: [{ message: error?.message || 'Internal Server Error' }] },
      { status: 500 },
    );
  }
}
