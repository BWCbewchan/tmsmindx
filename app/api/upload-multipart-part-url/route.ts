import { requireBearerAdminOrSuperMutation } from '@/lib/auth-server';
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory';
import { createSupabaseS3Client, isSupabaseS3Configured } from '@/lib/supabase-s3';
import { UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextRequest, NextResponse } from 'next/server';

const BUCKET_NAME = 'mindx-videos';
const MAX_PART_BYTES = 64 * 1024 * 1024;
const SIGNED_URL_EXPIRES_SECONDS = 15 * 60;

function isValidVideoKey(key: string): boolean {
  return /^video_dtnc\/[a-zA-Z0-9._-]+$/.test(key);
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireBearerAdminOrSuperMutation(req);
    if (!gate.ok) return gate.response;

    const rl = await rateLimitOr429Async(`upload-multipart-part-url:${clientIpFromRequest(req)}`, 240, 60_000);
    if (rl) return rl;

    if (!isSupabaseS3Configured()) {
      return NextResponse.json({ success: false, error: 'Chua cau hinh Supabase S3 Storage' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const key = String(body?.key || '').trim();
    const uploadId = String(body?.uploadId || '').trim();
    const partNumber = Number(body?.partNumber);
    const size = Number(body?.size || 0);

    if (!key || !uploadId || !Number.isInteger(partNumber) || partNumber <= 0 || partNumber > 10000) {
      return NextResponse.json({ success: false, error: 'Thong tin part upload khong hop le' }, { status: 400 });
    }
    if (!isValidVideoKey(key)) {
      return NextResponse.json({ success: false, error: 'Key upload khong hop le' }, { status: 400 });
    }
    if (!Number.isFinite(size) || size <= 0 || size > MAX_PART_BYTES) {
      return NextResponse.json({ success: false, error: 'Part upload vuot qua dung luong cho phep' }, { status: 400 });
    }

    const client = createSupabaseS3Client();
    const uploadUrl = await getSignedUrl(
      client,
      new UploadPartCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      }),
      { expiresIn: SIGNED_URL_EXPIRES_SECONDS },
    );

    return NextResponse.json({
      success: true,
      uploadUrl,
      PartNumber: partNumber,
      expiresInSeconds: SIGNED_URL_EXPIRES_SECONDS,
    });
  } catch (error: any) {
    console.error('Multipart part signed URL error:', error?.message || error);
    return NextResponse.json(
      { success: false, error: 'Khong the tao link upload truc tiep' },
      { status: 500 },
    );
  }
}
