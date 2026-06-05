import { requireBearerAdminOrSuperMutation } from '@/lib/auth-server';
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory';
import { createSupabaseS3Client, isSupabaseS3Configured } from '@/lib/supabase-s3';
import { UploadPartCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

const BUCKET_NAME = 'mindx-videos';
const MAX_PART_BYTES = 64 * 1024 * 1024;

function isValidVideoKey(key: string): boolean {
  return /^video_dtnc\/[a-zA-Z0-9._-]+$/.test(key);
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireBearerAdminOrSuperMutation(req);
    if (!gate.ok) return gate.response;

    const rl = await rateLimitOr429Async(`upload-multipart-part:${clientIpFromRequest(req)}`, 120, 60_000);
    if (rl) return rl;

    if (!isSupabaseS3Configured()) {
      return NextResponse.json({ error: 'Chua cau hinh Supabase S3 Storage' }, { status: 500 });
    }

    const formData = await req.formData();
    const key = String(formData.get('key') || '').trim();
    const uploadId = String(formData.get('uploadId') || '').trim();
    const partNumber = parseInt(String(formData.get('partNumber') || ''), 10);
    const file = formData.get('file');

    if (!key || !uploadId || !Number.isInteger(partNumber) || partNumber <= 0 || !file || typeof file === 'string') {
      return NextResponse.json({ error: 'Thieu thong tin part upload' }, { status: 400 });
    }
    if (!isValidVideoKey(key)) {
      return NextResponse.json({ error: 'Key upload khong hop le' }, { status: 400 });
    }
    if (file.size > MAX_PART_BYTES) {
      return NextResponse.json({ error: 'Part upload vuot qua dung luong cho phep' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const client = createSupabaseS3Client();
    const result = await client.send(
      new UploadPartCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: buffer,
      }),
    );

    return NextResponse.json({
      success: true,
      ETag: result.ETag,
      PartNumber: partNumber,
    });
  } catch (error: any) {
    console.error('Multipart part upload error:', error?.message || error);
    return NextResponse.json(
      { success: false, error: 'Khong the upload part' },
      { status: 500 },
    );
  }
}

