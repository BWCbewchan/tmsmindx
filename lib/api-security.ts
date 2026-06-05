import { NextRequest, NextResponse } from 'next/server';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function parseConfiguredOrigins(): string[] {
  const rawValues = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.ALLOWED_API_EXTRA_ORIGINS,
  ].filter(Boolean);

  return Array.from(
    new Set(
      rawValues
        .flatMap((raw) => String(raw).split(/[,;\s]+/g))
        .map((value) => normalizeOrigin(value))
        .filter(Boolean),
    ),
  );
}

function requestOrigins(request: NextRequest): Set<string> {
  const origins = new Set<string>();

  try {
    origins.add(new URL(request.url).origin);
  } catch {
    // Ignore malformed request URL; the Host fallback below still applies.
  }

  const host = request.headers.get('host')?.trim();
  if (host) {
    origins.add(`https://${host}`);
    if (process.env.NODE_ENV !== 'production') {
      origins.add(`http://${host}`);
    }
  }

  if (process.env.NODE_ENV === 'development') {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }

  for (const origin of parseConfiguredOrigins()) {
    origins.add(origin);
  }

  return origins;
}

export function requireSameOriginMutation(request: NextRequest): NextResponse | null {
  if (!MUTATION_METHODS.has(request.method.toUpperCase())) return null;

  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) return null;

  const allowedOrigins = requestOrigins(request);
  const origin = request.headers.get('origin')?.trim();
  if (origin && allowedOrigins.has(normalizeOrigin(origin))) return null;

  const referer = request.headers.get('referer')?.trim();
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (allowedOrigins.has(refererOrigin)) return null;
    } catch {
      // Fall through to reject.
    }
  }

  const secFetchSite = request.headers.get('sec-fetch-site')?.toLowerCase();
  if (!origin && !referer && secFetchSite === 'same-origin') return null;

  return NextResponse.json(
    { success: false, error: 'Request khong hop le: yeu cau thao tac tu dung ung dung.' },
    { status: 403 },
  );
}

