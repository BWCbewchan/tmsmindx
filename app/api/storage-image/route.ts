import { requireCandidateSession } from '@/lib/candidate-session';
import { requireBearerSession } from '@/lib/datasource-api-auth';
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory';
import { createSupabaseS3Client, isSupabaseS3Configured } from '@/lib/supabase-s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

const ANONYMOUS_READ_BUCKETS = new Set([
  'mindx-posts-content',
  'mindx-thumbnails',
]);

function parseStorageUrl(rawUrl: string): { bucket: string; key: string } | null {
  const match = rawUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1], key: match[2] };
}

function isSafeObjectKey(key: string): boolean {
  return Boolean(key) && !key.includes('..') && !key.startsWith('/');
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

    if (!isSupabaseS3Configured()) {
      return new NextResponse('Storage not configured', { status: 500 });
    }

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

    const isVideo = /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(key);
    const rangeHeader = request.headers.get('range');
    const client = createSupabaseS3Client();
    const getObjectParams: any = { Bucket: bucket, Key: key };
    if (isVideo && rangeHeader) {
      getObjectParams.Range = rangeHeader;
    }

    const result = await client.send(new GetObjectCommand(getObjectParams));
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

