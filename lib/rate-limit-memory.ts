import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const buckets = new Map<string, { count: number; resetAt: number }>();

export function clientIpFromRequest(request: NextRequest): string {
  const xf = request.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || '127.0.0.1';
}

/** Simple in-memory fixed-window limiter (best-effort; use Redis/Upstash in multi-instance prod). */
export function rateLimitOr429(
  key: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > limit) {
    return NextResponse.json(
      { success: false, error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' },
      { status: 429 },
    );
  }
  return null;
}

type UpstashPipelineItem = { result?: unknown; error?: string };

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token };
}

async function redisFixedWindowCount(
  key: string,
  windowMs: number,
): Promise<number | null> {
  const cfg = redisConfig();
  if (!cfg) return null;

  const windowBucket = Math.floor(Date.now() / windowMs);
  const redisKey = `rl:${key}:${windowBucket}`;

  try {
    const response = await fetch(`${cfg.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['PEXPIRE', redisKey, Math.ceil(windowMs * 1.2)],
      ]),
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as UpstashPipelineItem[];
    const count = Number(data?.[0]?.result);
    return Number.isFinite(count) ? count : null;
  } catch {
    return null;
  }
}

/** Distributed limiter when Upstash Redis is configured; falls back to in-memory locally. */
export async function rateLimitOr429Async(
  key: string,
  limit: number,
  windowMs: number,
): Promise<NextResponse | null> {
  const redisCount = await redisFixedWindowCount(key, windowMs);
  if (redisCount != null) {
    if (redisCount > limit) {
      return NextResponse.json(
        { success: false, error: 'Qua nhieu yeu cau. Vui long thu lai sau.' },
        { status: 429 },
      );
    }
    return null;
  }

  return rateLimitOr429(key, limit, windowMs);
}
