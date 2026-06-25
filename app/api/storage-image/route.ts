import { requireCandidateSession } from '@/lib/candidate-session';
import { requireBearerSession } from '@/lib/datasource-api-auth';
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory';
import {
  createSupabaseS3Client,
  getPublicObjectUrl,
  getSignedObjectUrl,
  isSupabaseS3Configured,
} from '@/lib/supabase-s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

const ANONYMOUS_READ_BUCKETS = new Set([
  'mindx-posts-content',
  'mindx-thumbnails',
]);
const SIGNED_REDIRECT_BUCKET_TTLS = new Map<string, number>([
  ['mindx-posts-content', 12 * 60 * 60],
  ['mindx-thumbnails', 12 * 60 * 60],
  ['mindx-question-images', 60 * 60],
  ['mindx-videos', 30 * 60],
]);
const DEFAULT_SIGNED_REDIRECT_TTL = 15 * 60;

function parseStorageUrl(rawUrl: string): { bucket: string; key: string } | null {
  try {
    const parsed = new URL(rawUrl);
    const match = parsed.pathname.match(
      /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/,
    );
    if (!match) return null;
    return {
      bucket: decodeURIComponent(match[1]),
      key: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
}

function isSafeObjectKey(key: string): boolean {
  return Boolean(key) && !key.includes('..') && !key.startsWith('/');
}

function redirectToObjectUrl(url: string, bucket: string, ttlSeconds?: number) {
  const isAnonymousBucket = ANONYMOUS_READ_BUCKETS.has(bucket);
  const sharedMaxAge = ttlSeconds
    ? Math.max(60, ttlSeconds - 5 * 60)
    : 7 * 24 * 60 * 60;
  const response = NextResponse.redirect(url, 307);
  response.headers.set(
    'Cache-Control',
    isAnonymousBucket
      ? `public, max-age=${sharedMaxAge}, s-maxage=${sharedMaxAge}, stale-while-revalidate=300`
      : 'private, max-age=300',
  );
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}

async function requireReadAccess(
  request: NextRequest,
  bucket: string,
  key: string,
): Promise<NextResponse | null> {
  if (ANONYMOUS_READ_BUCKETS.has(bucket)) return null;

  if (bucket === 'mindx-candidate-harvest') {
    const candidateAuth = await requireCandidateSession(request);
    if (!candidateAuth.ok) return candidateAuth.response;
    if (!key.startsWith(`harvest/${candidateAuth.candidateId}/`)) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    return null;
  }

  const auth = await requireBearerSession(request);
  if (!auth.ok) return auth.response;
  return null;
}

export async function GET(request: NextRequest) {
  let bucket: string | null = null;
  let key: string | null = null;

  try {
    const rl = await rateLimitOr429Async(`storage-image:${clientIpFromRequest(request)}`, 300, 60_000);
    if (rl) return rl;

    const { searchParams } = new URL(request.url);
    bucket = searchParams.get('bucket');
    key = searchParams.get('key');

    const rawUrl = searchParams.get('url');
    if (rawUrl && (!bucket || !key)) {
      const parsed = parseStorageUrl(rawUrl);
      if (parsed) {
        bucket = parsed.bucket;
        key = parsed.key;
      }
    }

    if (!bucket || !key || !isSafeObjectKey(key)) {
      return new NextResponse('Missing or invalid bucket/key', { status: 400 });
    }

    const denied = await requireReadAccess(request, bucket, key);
    if (denied) return denied;

    if (!isSupabaseS3Configured()) {
      if (ANONYMOUS_READ_BUCKETS.has(bucket)) {
        return redirectToObjectUrl(getPublicObjectUrl(bucket, key), bucket);
      }
      return new NextResponse('Storage not configured', { status: 500 });
    }

    const isVideo = /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(key);
    // Keep legacy proxy=1 URLs working, but prefer direct storage delivery.
    // stream=1 is reserved for diagnostics when signed URLs are unavailable.
    // Force proxy streaming for videos to avoid Range request/seeking issues over 307 redirects.
    const forceStream = searchParams.get('stream') === '1' || isVideo;
    if (!forceStream) {
      const signedRedirectTtl =
        SIGNED_REDIRECT_BUCKET_TTLS.get(bucket) ?? DEFAULT_SIGNED_REDIRECT_TTL;
      try {
        const objectUrl = await getSignedObjectUrl(bucket, key, signedRedirectTtl);
        return redirectToObjectUrl(objectUrl, bucket, signedRedirectTtl);
      } catch (error: any) {
        console.warn('[storage-proxy] direct redirect failed, fallback to proxy stream:', error?.message || error);
      }
    }

    const rangeHeader = request.headers.get('range');
    const client = createSupabaseS3Client();
    const getObjectParams: any = { Bucket: bucket, Key: key };
    if (isVideo && rangeHeader) {
      getObjectParams.Range = rangeHeader;
    }

    const result = await client.send(
      new GetObjectCommand(getObjectParams),
      // Abort the S3 download if the browser closes the connection
      // (e.g., during video seeking or page navigation).
      { abortSignal: request.signal },
    );
    if (!result.Body) {
      return new NextResponse('Not found', { status: 404 });
    }

    const stream = result.Body.transformToWebStream();
    const headers: Record<string, string> = {
      'Content-Type': result.ContentType || (isVideo ? 'video/mp4' : 'application/octet-stream'),
      'Accept-Ranges': 'bytes',
      'Cache-Control': ANONYMOUS_READ_BUCKETS.has(bucket)
        ? 'public, max-age=604800, s-maxage=86400'
        : 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    };

    if (result.ContentLength != null) {
      headers['Content-Length'] = String(result.ContentLength);
    }
    if (result.ContentRange) {
      headers['Content-Range'] = result.ContentRange;
    }

    return new NextResponse(stream, {
      status: isVideo && rangeHeader && result.ContentRange ? 206 : 200,
      headers,
    });
  } catch (error: any) {
    // Client disconnected (e.g., video seek, page navigation) — silent, not an error.
    if (
      error?.name === 'AbortError' ||
      error?.name === 'RequestAbortedError' ||
      error?.code === 'ERR_ABORTED'
    ) {
      return new NextResponse(null, { status: 499 });
    }
    if (error?.name === 'InvalidRange' || error?.$metadata?.httpStatusCode === 416) {
      return new NextResponse('Range Not Satisfiable', { status: 416 });
    }
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
      console.warn(`[storage-proxy] NoSuchKey: ${bucket}/${key}`);
      return new NextResponse('Not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
      });
    }

    console.error('Storage proxy error:', error?.message || error);
    return new NextResponse('Not found', { status: 404 });
  }
}
