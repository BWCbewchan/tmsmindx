import { withApiProtection } from '@/lib/api-protection';
import { requireBearerOrSessionCookie } from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Internal endpoint — import điểm đào tạo nâng cao từ Google Sheet vào DB.
 *
 * Được gọi từ front‑end khi giáo viên đăng nhập lần đầu (hoặc chưa có điểm).
 * Luôn idempotent: nếu đã có điểm thì skip, không ghi đè điểm tốt hơn.
 *
 * Bảo mật:
 *  - withApiProtection: kiểm tra Origin/Referer (ngăn gọi trực tiếp từ curl/Postman).
 *  - requireBearerOrSessionCookie: xác thực phiên đăng nhập.
 *  - Ownership check: teacherCode phải thuộc về session hiện tại.
 *  - Prepared statements + transaction.
 *  - Response tối thiểu — không lộ chi tiết lỗi nội bộ ra client.
 */

const SPREADSHEET_ID = '1pOfZp4w__q-KBEE-wrwGjjq_J3KSjAYfpHCJxL-LsGs';
const SHEET_GID = '1375184237'; // Tab "Dashboard"

// Mapping cột CSV (0-based) → video_id trong DB
const COLUMN_TO_VIDEO_ID: Record<number, number> = {
  11: 84, // Lesson 1
  12: 85, // Lesson 2
  13: 87, // Lesson 3
  14: 86, // Lesson 4
  15: 82, // Lesson 5
  16: 83, // Lesson 6
  17: 89, // Lesson 7
  18: 79, // Lesson 8
  19: 81, // Lesson 9
  20: 80, // Lesson 10
  21: 88, // Lesson 11
  22: 78, // Lesson 12
};

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') { currentField += '"'; i++; }
      else if (char === '"') { inQuotes = false; }
      else { currentField += char; }
    } else {
      if (char === '"') { inQuotes = true; }
      else if (char === ',') { currentRow.push(currentField); currentField = ''; }
      else if (char === '\r' || char === '\n') {
        currentRow.push(currentField);
        if (currentRow.some(f => f !== '')) rows.push(currentRow);
        currentRow = [];
        currentField = '';
        if (char === '\r' && nextChar === '\n') i++;
      } else { currentField += char; }
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some(f => f !== '')) rows.push(currentRow);
  }
  return rows;
}

// ─── Handler (bọc withApiProtection — ngăn curl/Postman không có Origin) ─────
export const POST = withApiProtection(async (request: NextRequest) => {
  // ── 1. Xác thực phiên ───────────────────────────────────────────────────────
  const auth = await requireBearerOrSessionCookie(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const teacherCodeRaw = String(body?.teacherCode || '').trim();
  if (!teacherCodeRaw) {
    return NextResponse.json(
      { success: false, error: 'teacherCode is required' },
      { status: 400 },
    );
  }

  const teacherCode = teacherCodeRaw.toLowerCase();
  const sessionEmail = (auth.sessionEmail ?? '').toLowerCase().trim();
  const emailPrefix = sessionEmail.split('@')[0];

  // ── 2. Ownership check ──────────────────────────────────────────────────────
  // Ưu tiên 1: email prefix khớp teacherCode (trường hợp phổ biến nhất)
  // Ưu tiên 2: lookup trong teachers (code ≠ email prefix, e.g. "gv001")
  // Ưu tiên 3: giáo viên hoàn toàn mới, chưa có trong teachers — cho phép nếu
  //            KHÔNG tìm thấy teacherCode của người khác trong teachers
  //            (tức là teacherCode này chưa thuộc về ai)
  let isAuthorized = (emailPrefix === teacherCode);

  if (!isAuthorized) {
    try {
      const dbCheck = await pool.query(
        `SELECT LOWER(TRIM(COALESCE(work_email, ""Work email""))) AS email
         FROM teachers
         WHERE LOWER(TRIM(code)) = $1
         LIMIT 1`,
        [teacherCode],
      );
      if (dbCheck.rows.length > 0) {
        const ownerEmail = String(dbCheck.rows[0].email || '').toLowerCase().trim();
        // teacherCode thuộc về email này — chỉ cho phép nếu đúng session
        isAuthorized = (ownerEmail === sessionEmail);
      } else {
        // teacherCode chưa có trong teachers — giáo viên mới, cho phép import
        // (họ đang trong quá trình onboarding, teachers được tạo ngay sau đó)
        isAuthorized = true;
      }
    } catch (err) {
      console.error('[ImportTeacherScores] Ownership DB check error:', err);
      // Fail-safe: nếu DB lỗi, tiếp tục với email-prefix check kết quả
    }
  }

  if (!isAuthorized) {
    return NextResponse.json(
      { success: false, error: 'Forbidden' },
      { status: 403 },
    );
  }

  const client = await pool.connect();

  try {
    // ── 3. Idempotency check — đã có điểm thì skip ──────────────────────────
    const existing = await client.query(
      `SELECT 1 FROM training_teacher_video_scores
       WHERE LOWER(TRIM(teacher_code)) = $1
       LIMIT 1`,
      [teacherCode],
    );
    if ((existing.rowCount ?? 0) > 0) {
      return NextResponse.json({ success: true, alreadyImported: true });
    }

    // ── 4. Fetch sheet CSV ───────────────────────────────────────────────────
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
    const csvRes = await fetch(csvUrl, {
      // Timeout 15s — tránh treo connection pool khi Google Sheets chậm
      signal: AbortSignal.timeout(15_000),
    });
    if (!csvRes.ok) {
      throw new Error(`Google Sheets fetch failed: ${csvRes.status}`);
    }
    const csvText = await csvRes.text();
    const rows = parseCSV(csvText);

    // ── 5. Tìm dòng của giáo viên (cột index 2 = teacher code) ──────────────
    const targetRow = rows.find(
      (r) => (r[2] ?? '').trim().toLowerCase() === teacherCode,
    );

    if (!targetRow) {
      // Không có trong sheet — không phải lỗi, giáo viên này chưa được training
      return NextResponse.json(
        { success: false, notInSheet: true, error: 'Teacher not found in sheet' },
        { status: 404 },
      );
    }

    const fullName = (targetRow[1] || teacherCode).trim();

    // ── 6. Chuẩn bị batch insert ─────────────────────────────────────────────
    // Gom tất cả điểm hợp lệ thành 1 query thay vì N queries tuần tự
    type ScoreRow = { videoId: number; score: number };
    const validScores: ScoreRow[] = [];

    for (const [colIdxStr, videoId] of Object.entries(COLUMN_TO_VIDEO_ID)) {
      const colIdx = Number(colIdxStr);
      const raw = targetRow[colIdx];
      if (!raw) continue;

      const cleaned = raw.replace(/"/g, '').trim().replace(',', '.');
      const score = parseFloat(cleaned);
      if (isNaN(score) || score <= 0) continue;

      validScores.push({ videoId, score });
    }

    if (validScores.length === 0) {
      // Có trong sheet nhưng chưa có điểm hợp lệ — trả về success để không retry
      return NextResponse.json({ success: true, imported: false, noValidScores: true });
    }

    // ── 7. Transaction: upsert stats + batch insert scores ───────────────────
    await client.query('BEGIN');

    // 7.1 Đảm bảo parent row tồn tại trong training_teacher_stats
    await client.query(
      `INSERT INTO training_teacher_stats (teacher_code, full_name, work_email, status)
       VALUES ($1, $2, '', 'Active')
       ON CONFLICT (teacher_code) DO NOTHING`,
      [teacherCode, fullName],
    );

    // 7.2 Batch insert bằng unnest — 1 round-trip thay vì 12
    const videoIds = validScores.map((s) => s.videoId);
    const scores   = validScores.map((s) => s.score);
    const statuses = validScores.map(() => 'completed');

    await client.query(
      `INSERT INTO training_teacher_video_scores (teacher_code, video_id, score, completion_status)
       SELECT $1, v.video_id, v.score, v.status
       FROM unnest(
         $2::int[],
         $3::numeric[],
         $4::text[]
       ) AS v(video_id, score, status)
       ON CONFLICT (teacher_code, video_id) DO UPDATE
         SET score             = EXCLUDED.score,
             completion_status = CASE
               WHEN training_teacher_video_scores.completion_status = 'watched' THEN 'watched'
               ELSE EXCLUDED.completion_status
             END,
             updated_at = NOW()
       WHERE training_teacher_video_scores.score < EXCLUDED.score
          OR training_teacher_video_scores.score IS NULL`,
      [teacherCode, videoIds, scores, statuses],
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      imported: true,
      count: validScores.length,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ImportTeacherScores] error:', err);
    return NextResponse.json(
      { success: false, error: 'Import failed' },
      { status: 500 },
    );
  } finally {
    client.release();
  }
});
