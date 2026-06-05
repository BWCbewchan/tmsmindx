import { requireBearerAdminOrSuperMutation } from '@/lib/auth-server';
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory';
import { createSupabaseS3Client, isSupabaseS3Configured } from '@/lib/supabase-s3';
import { CreateBucketCommand, CreateMultipartUploadCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

const BUCKET_NAME = 'mindx-videos';
const ALLOWED_VIDEO_CONTENT_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
]);

async function ensureBucket() {
  const client = createSupabaseS3Client();
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
  }
}

function safeVideoKey(filename: string): string {
  const ext = filename.includes('.') ? filename.split('.').pop() : 'mp4';
  const baseName = filename
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'video';

  return `video_dtnc/${Date.now()}-${baseName}.${ext}`;
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireBearerAdminOrSuperMutation(req);
    if (!gate.ok) return gate.response;

    const rl = await rateLimitOr429Async(`upload-multipart-init:${clientIpFromRequest(req)}`, 30, 60_000);
    if (rl) return rl;

    if (!isSupabaseS3Configured()) {
      return NextResponse.json({ error: 'Chua cau hinh Supabase S3 Storage' }, { status: 500 });
    }

    const body = await req.json();
    const filename = String(body?.filename || '').trim();
    const contentType = String(body?.contentType || 'video/mp4').trim();

    if (!filename) {
      return NextResponse.json({ error: 'Thieu filename' }, { status: 400 });
    }
    if (!ALLOWED_VIDEO_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Dinh dang video khong duoc phep' }, { status: 400 });
    }

    await ensureBucket();
    const client = createSupabaseS3Client();
    const key = safeVideoKey(filename);

    const result = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: contentType,
      }),
    );

    return NextResponse.json({
      success: true,
      uploadId: result.UploadId,
      key,
      bucket: BUCKET_NAME,
    });
  } catch (error) {
    console.error('Multipart init error:', error);
    return NextResponse.json({ error: 'Khong the khoi tao multipart upload' }, { status: 500 });
  }
}

