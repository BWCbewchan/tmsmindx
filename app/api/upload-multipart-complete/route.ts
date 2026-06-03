import { requireBearerAdminOrSuperMutation } from '@/lib/auth-server';
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory';
import { createSupabaseS3Client, isSupabaseS3Configured } from '@/lib/supabase-s3';
import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

const BUCKET_NAME = 'mindx-videos';

function makeProxyUrl(bucket: string, key: string): string {
  return `/api/storage-image?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`;
}

function isValidVideoKey(key: string): boolean {
  return /^video_dtnc\/[a-zA-Z0-9._-]+$/.test(key);
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireBearerAdminOrSuperMutation(req);
    if (!gate.ok) return gate.response;

    const rl = await rateLimitOr429Async(`upload-multipart-complete:${clientIpFromRequest(req)}`, 30, 60_000);
    if (rl) return rl;

    if (!isSupabaseS3Configured()) {
      return NextResponse.json({ error: 'Chua cau hinh Supabase S3 Storage' }, { status: 500 });
    }

    const body = await req.json();
    const key = String(body?.key || '').trim();
    const uploadId = String(body?.uploadId || '').trim();
    const parts = body?.parts;

    if (!key || !uploadId || !Array.isArray(parts)) {
      return NextResponse.json({ error: 'Thieu thong tin complete upload' }, { status: 400 });
    }
    if (!isValidVideoKey(key) || parts.length === 0 || parts.length > 10000) {
      return NextResponse.json({ error: 'Thong tin complete upload khong hop le' }, { status: 400 });
    }

    const client = createSupabaseS3Client();
    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((p: any) => ({
            ETag: String(p.ETag || ''),
            PartNumber: Number(p.PartNumber),
          })),
        },
      }),
    );

    const url = makeProxyUrl(BUCKET_NAME, key);

    return NextResponse.json({
      success: true,
      url,
      key,
      bucket: BUCKET_NAME,
      storagePath: `s3://${BUCKET_NAME}/${key}`,
    });
  } catch (error) {
    console.error('Multipart complete error:', error);
    return NextResponse.json({ error: 'Khong the hoan tat upload' }, { status: 500 });
  }
}

