import pool from '@/lib/db';
import { clientIpFromRequest, rateLimitOr429Async } from '@/lib/rate-limit-memory';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CREATED_BY_EMAIL = 'public-candidate-form@mindx.vn';
const REGION_LABELS: Record<string, string> = {
  '1': 'Hồ Chí Minh',
  '2': 'Hà Nội',
  '3': 'Tỉnh Nam',
  '4': 'Tỉnh Bắc',
  '5': 'Tỉnh Trung',
};

type CandidateApplicationPayload = {
  full_name?: unknown;
  email?: unknown;
  phone?: unknown;
  region_code?: unknown;
  desired_campus?: unknown;
  work_block?: unknown;
  subject_code?: unknown;
  birth_year?: unknown;
  gender?: unknown;
  current_address?: unknown;
  facebook_url?: unknown;
  teaching_experience?: unknown;
  pedagogy_certificate_url?: unknown;
  website?: unknown;
};

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizeEmail(value: unknown) {
  return normalizeText(value, 255).toLowerCase();
}

function normalizePhone(value: unknown) {
  return normalizeText(value, 50).replace(/[^\d+]/g, '');
}

function nullable(value: string) {
  return value || null;
}

function normalizeOptionalHttpUrl(value: unknown, maxLength: number) {
  const raw = normalizeText(value, maxLength);
  if (!raw) return { ok: true as const, value: '' };

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false as const, value: '' };
    }
    return { ok: true as const, value: parsed.toString().slice(0, maxLength) };
  } catch {
    return { ok: false as const, value: '' };
  }
}

function parseBirthYear(value: unknown) {
  const raw = normalizeText(value, 4);
  if (!raw) return null;
  const year = Number(raw);
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 1950 || year > currentYear - 16) return null;
  return year;
}

function validatePayload(body: CandidateApplicationPayload) {
  if (normalizeText(body.website, 200)) {
    return { ok: false as const, error: 'Yêu cầu không hợp lệ.' };
  }

  const fullName = normalizeText(body.full_name, 255);
  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.phone);
  const regionCode = normalizeText(body.region_code, 10);
  const desiredCampus = normalizeText(body.desired_campus, 255);
  const workBlock = normalizeText(body.work_block, 100);
  const subjectCode = normalizeText(body.subject_code, 100);
  const gender = normalizeText(body.gender, 30);
  const currentAddress = normalizeText(body.current_address, 500);
  const facebookUrl = normalizeText(body.facebook_url, 500);
  const teachingExperience = normalizeText(body.teaching_experience, 1000);
  const pedagogyCertificateUrl = normalizeOptionalHttpUrl(body.pedagogy_certificate_url, 1000);
  const birthYear = parseBirthYear(body.birth_year);

  if (!fullName) return { ok: false as const, error: 'Vui lòng nhập họ và tên.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: 'Email không hợp lệ.' };
  }
  if (phone.length < 9 || phone.length > 16) {
    return { ok: false as const, error: 'Số điện thoại không hợp lệ.' };
  }
  if (!REGION_LABELS[regionCode]) {
    return { ok: false as const, error: 'Vui lòng chọn khu vực.' };
  }
  if (!desiredCampus) return { ok: false as const, error: 'Vui lòng nhập cơ sở mong muốn.' };
  if (!workBlock) return { ok: false as const, error: 'Vui lòng chọn khối/môn ứng tuyển.' };
  if (!pedagogyCertificateUrl.ok) {
    return { ok: false as const, error: 'Link văn bằng/chứng chỉ sư phạm không hợp lệ.' };
  }
  if (teachingExperience && !pedagogyCertificateUrl.value) {
    return { ok: false as const, error: 'Vui lòng gửi link văn bằng/chứng chỉ sư phạm nếu có kinh nghiệm giảng dạy.' };
  }

  return {
    ok: true as const,
    data: {
      fullName,
      email,
      phone,
      regionCode,
      regionName: REGION_LABELS[regionCode],
      desiredCampus,
      workBlock,
      subjectCode,
      birthYear,
      gender,
      currentAddress,
      facebookUrl,
      teachingExperience,
      pedagogyCertificateUrl: pedagogyCertificateUrl.value,
    },
  };
}

export async function POST(request: NextRequest) {
  const limited = await rateLimitOr429Async(
    `public-candidate-application:${clientIpFromRequest(request)}`,
    8,
    60_000,
  );
  if (limited) return limited;

  try {
    const body = (await request.json().catch(() => ({}))) as CandidateApplicationPayload;
    const validation = validatePayload(body);
    if (!validation.ok) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const data = validation.data;
    const duplicateResult = await pool.query(
      `SELECT id, email, phone
       FROM hr_candidates
       WHERE is_deleted = false
         AND (
           LOWER(email) = LOWER($1)
           OR regexp_replace(COALESCE(phone, ''), '[^0-9+]', '', 'g') = $2
         )
       LIMIT 1`,
      [data.email, data.phone],
    );

    if (duplicateResult.rowCount && duplicateResult.rowCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Thông tin này đã được ghi nhận. Nếu cần cập nhật, vui lòng liên hệ HR/TE phụ trách.',
        },
        { status: 409 },
      );
    }

    const result = await pool.query(
      `INSERT INTO hr_candidates (
         full_name,
         email,
         phone,
         region_code,
         desired_campus,
         work_block,
         subject_code,
         gen_id,
         initial_gen_id,
         current_gen_id,
         source,
         created_by_email,
         status,
         birth_year,
         facebook_url,
         teaching_experience,
         pedagogy_certificate_url,
         gender,
         current_address,
         region_name
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         NULL, NULL, NULL,
         'manual', $8, 'new',
         $9, $10, $11, $12, $13, $14, $15
       )
       RETURNING id, full_name, email, status, created_at`,
      [
        data.fullName,
        data.email,
        data.phone,
        data.regionCode,
        data.desiredCampus,
        data.workBlock,
        nullable(data.subjectCode),
        CREATED_BY_EMAIL,
        data.birthYear,
        nullable(data.facebookUrl),
        nullable(data.teachingExperience),
        nullable(data.pedagogyCertificateUrl),
        nullable(data.gender),
        nullable(data.currentAddress),
        data.regionName,
      ],
    );

    return NextResponse.json(
      { success: true, candidate: result.rows[0] },
      { status: 201 },
    );
  } catch (error) {
    console.error('Public HR candidate application error:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể gửi thông tin lúc này. Vui lòng thử lại sau.' },
      { status: 500 },
    );
  }
}
