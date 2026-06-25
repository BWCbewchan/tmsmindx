/**
 * backfill_training_scores_from_sheet.js
 *
 * Script một lần dùng để:
 *  1. Lấy toàn bộ giáo viên từ bảng `teachers`
 *  2. Fetch sheet điểm đào tạo nâng cao từ Google Sheets (public CSV export)
 *  3. So sánh: chỉ import nếu giáo viên CHƯA có bất kỳ điểm nào trong training_teacher_video_scores
 *  4. KHÔNG thay đổi dữ liệu trong bảng `teachers`
 *
 * Usage:
 *   node scripts/backfill_training_scores_from_sheet.js
 *   node scripts/backfill_training_scores_from_sheet.js --dry-run   (chỉ xem, không ghi DB)
 *
 * Yêu cầu: file .env ở thư mục gốc project chứa DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 */

require('dotenv').config();
const https = require('https');
const { Pool } = require('pg');

// ─── Config ───────────────────────────────────────────────────────────────────
const SPREADSHEET_ID = '1pOfZp4w__q-KBEE-wrwGjjq_J3KSjAYfpHCJxL-LsGs';
const SHEET_GID = '1375184237'; // Tab "Dashboard"

// Mapping cột CSV (0-based index) → video_id trong Supabase
const COLUMN_TO_VIDEO_ID = {
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

const isDryRun = process.argv.includes('--dry-run');

// ─── DB Pool ──────────────────────────────────────────────────────────────────
function buildPoolConfig() {
  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  const dbHost = (process.env.DB_HOST || '').trim();
  const dbUser = (process.env.DB_USER || '').trim();
  const dbName = (process.env.DB_NAME || '').trim();

  const hostLooksHosted = /supabase\.co|neon\.tech|aiven\.io|aivencloud\.com|amazonaws\.com|render\.com|railway\.app/i.test(dbHost);
  const urlLooksHosted = /supabase\.co|neon\.tech|aiven\.io|aivencloud\.com|amazonaws\.com|render\.com|railway\.app/i.test(databaseUrl);
  const looksLikeAivenDefaults = dbUser === 'avnadmin' || dbName === 'defaultdb';
  const useSsl = hostLooksHosted || urlLooksHosted || looksLikeAivenDefaults || process.env.DB_SSL === 'true';

  const ssl = useSsl ? { rejectUnauthorized: false } : undefined;

  if (databaseUrl) return { connectionString: databaseUrl, ssl };

  return {
    host: dbHost,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: dbName,
    user: dbUser,
    password: process.env.DB_PASSWORD,
    ssl,
  };
}

const pool = new Pool(buildPoolConfig());

// ─── CSV Helpers ──────────────────────────────────────────────────────────────
function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Handle redirects (Google Drive often redirects)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchText(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Simple CSV parser — handles quoted fields containing commas.
 * @param {string} text
 * @returns {string[][]}
 */
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') { currentField += '"'; i++; }
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
        if (char === '\r' && next === '\n') i++;
      } else { currentField += char; }
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some(f => f !== '')) rows.push(currentRow);
  }
  return rows;
}

/** Parse điểm từ chuỗi CSV — xử lý dấu phẩy thập phân kiểu VN (7,5) và US (7.5) */
function parseScore(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/"/g, '').trim().replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       BACKFILL Training Scores from Google Sheet             ║');
  console.log(`║       Mode: ${isDryRun ? '🔍 DRY-RUN (không ghi DB)         ' : '✏️  LIVE (ghi vào DB)              '}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const client = await pool.connect();

  try {
    // ── Step 1: Lấy tất cả giáo viên từ bảng teachers ──────────────────────
    console.log('📋 Bước 1: Lấy danh sách giáo viên từ bảng teachers...');
    const teachersResult = await client.query(`
      SELECT 
        LOWER(TRIM(code)) AS code,
        full_name,
        COALESCE(NULLIF(TRIM(work_email), ''), NULLIF(TRIM("Work email"), '')) AS work_email,
        COALESCE(NULLIF(TRIM(main_centre), ''), NULLIF(TRIM("Main centre"), '')) AS center
      FROM teachers
      WHERE code IS NOT NULL AND TRIM(code) <> ''
      ORDER BY code ASC
    `);
    const allTeachers = teachersResult.rows;
    console.log(`   → Tìm thấy ${allTeachers.length} giáo viên trong bảng teachers.\n`);

    // ── Step 2: Lấy danh sách teacher_code đã có điểm trong DB ─────────────
    console.log('🗄️  Bước 2: Kiểm tra ai đã có điểm trong training_teacher_video_scores...');
    const existingScoresResult = await client.query(`
      SELECT DISTINCT LOWER(TRIM(teacher_code)) AS teacher_code
      FROM training_teacher_video_scores
    `);
    const existingCodes = new Set(existingScoresResult.rows.map(r => r.teacher_code));
    console.log(`   → ${existingCodes.size} giáo viên đã có điểm trong hệ thống.\n`);

    // ── Step 3: Xác định giáo viên CHƯA có điểm ────────────────────────────
    const teachersWithoutScores = allTeachers.filter(t => !existingCodes.has(t.code));
    console.log(`📊 Bước 3: Phân tích:`);
    console.log(`   ✅ Đã có điểm  : ${existingCodes.size} giáo viên`);
    console.log(`   ❌ Chưa có điểm: ${teachersWithoutScores.length} giáo viên`);
    console.log(`   📌 Tổng cộng   : ${allTeachers.length} giáo viên\n`);

    if (teachersWithoutScores.length === 0) {
      console.log('✅ Tất cả giáo viên đã có điểm. Không cần backfill.\n');
      return;
    }

    // Tạo Set để lookup nhanh
    const codesNeedingScores = new Set(teachersWithoutScores.map(t => t.code));
    console.log('👥 Giáo viên chưa có điểm:');
    for (const t of teachersWithoutScores) {
      console.log(`   - [${t.code}] ${t.name || t.full_name || '(chưa có tên)'}`);
    }
    console.log();

    // ── Step 4: Fetch sheet điểm từ Google Sheets ───────────────────────────
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
    console.log('📥 Bước 4: Đang tải sheet điểm từ Google Sheets...');
    console.log(`   URL: ${csvUrl}`);
    const csvText = await fetchText(csvUrl);
    const allRows = parseCSV(csvText);
    console.log(`   → Tải về ${allRows.length} dòng từ sheet.\n`);

    // ── Step 5: Tìm các dòng trong sheet khớp với giáo viên cần import ──────
    console.log('🔍 Bước 5: Khớp giáo viên với dữ liệu trong sheet...');

    // Code nằm ở cột index 2, tên ở cột index 1
    const matchedRows = [];
    const notFoundInSheet = [];

    for (const teacher of teachersWithoutScores) {
      const sheetRow = allRows.find(r => {
        const sheetCode = (r[2] || '').trim().toLowerCase();
        return sheetCode === teacher.code;
      });

      if (sheetRow) {
        matchedRows.push({ teacher, sheetRow });
      } else {
        notFoundInSheet.push(teacher);
      }
    }

    console.log(`   → Khớp được ${matchedRows.length}/${teachersWithoutScores.length} giáo viên trong sheet.`);
    if (notFoundInSheet.length > 0) {
      console.log(`   ⚠️  Không tìm thấy trong sheet (${notFoundInSheet.length} người):`);
      for (const t of notFoundInSheet) {
        console.log(`      - [${t.code}] ${t.full_name || '(chưa có tên)'}`);
      }
    }
    console.log();

    if (matchedRows.length === 0) {
      console.log('ℹ️  Không có giáo viên nào trong sheet cần import. Kết thúc.\n');
      return;
    }

    // ── Step 6: Xem trước điểm sẽ được import ───────────────────────────────
    console.log('📋 Bước 6: Chi tiết điểm sẽ được import:\n');
    console.log('─'.repeat(100));
    
    const importPlan = [];

    for (const { teacher, sheetRow } of matchedRows) {
      const scores = [];
      for (const [colIdxStr, videoId] of Object.entries(COLUMN_TO_VIDEO_ID)) {
        const colIdx = Number(colIdxStr);
        const score = parseScore(sheetRow[colIdx]);
        if (score !== null && score > 0) {
          scores.push({ videoId, score });
        }
      }

      const lessonSummary = scores.map(s => `L${Object.entries(COLUMN_TO_VIDEO_ID).find(([,v]) => v === s.videoId)?.[0] ? Object.keys(COLUMN_TO_VIDEO_ID).indexOf(Object.entries(COLUMN_TO_VIDEO_ID).find(([,v]) => v === s.videoId)[0]) + 1 : '?'}=${s.score}`).join(' | ');
      
      console.log(`[${teacher.code}] ${(teacher.full_name || '').padEnd(30)} | ${scores.length} bài có điểm | ${lessonSummary || '(không có điểm hợp lệ)'}`);
      
      if (scores.length > 0) {
        importPlan.push({ teacher, scores });
      }
    }

    const teachersWithNoValidScores = matchedRows.length - importPlan.length;
    console.log('─'.repeat(100));
    console.log(`\n   → Sẽ import điểm cho ${importPlan.length} giáo viên.`);
    if (teachersWithNoValidScores > 0) {
      console.log(`   ℹ️  ${teachersWithNoValidScores} giáo viên trong sheet nhưng không có điểm hợp lệ (tất cả = 0 hoặc trống).`);
    }
    console.log();

    if (isDryRun) {
      console.log('🔍 DRY-RUN: Dừng ở đây, không ghi vào DB.');
      console.log('   Chạy lại không có --dry-run để thực sự import.\n');
      return;
    }

    // ── Step 7: Import vào DB ────────────────────────────────────────────────
    console.log('💾 Bước 7: Bắt đầu import vào database...\n');

    let totalImported = 0;
    let totalSkipped = 0;
    const importErrors = [];

    await client.query('BEGIN');

    try {
      for (const { teacher, scores } of importPlan) {
        // 7.1 Đảm bảo teacher tồn tại trong training_teacher_stats (parent table)
        //     Dùng dữ liệu từ bảng teachers (không thay đổi bảng teachers)
        await client.query(`
          INSERT INTO training_teacher_stats (teacher_code, full_name, work_email, center, status)
          VALUES ($1, $2, $3, $4, 'Active')
          ON CONFLICT (teacher_code) DO UPDATE SET
            full_name  = COALESCE(NULLIF(EXCLUDED.full_name, ''),  training_teacher_stats.full_name),
            work_email = COALESCE(NULLIF(EXCLUDED.work_email, ''), training_teacher_stats.work_email),
            center     = COALESCE(NULLIF(EXCLUDED.center, ''),     training_teacher_stats.center),
            updated_at = NOW()
        `, [
          teacher.code,
          teacher.full_name || teacher.code,
          teacher.work_email || '',
          teacher.center || '',
        ]);

        // 7.2 Insert điểm từng lesson
        for (const { videoId, score } of scores) {
          try {
            const res = await client.query(`
              INSERT INTO training_teacher_video_scores
                (teacher_code, video_id, score, completion_status)
              VALUES ($1, $2, $3, 'completed')
              ON CONFLICT (teacher_code, video_id) DO UPDATE
                SET score             = EXCLUDED.score,
                    completion_status = CASE
                      WHEN training_teacher_video_scores.completion_status = 'watched' THEN 'watched'
                      ELSE EXCLUDED.completion_status
                    END,
                    updated_at = NOW()
              WHERE training_teacher_video_scores.score < EXCLUDED.score
                 OR training_teacher_video_scores.score IS NULL
            `, [teacher.code, videoId, score]);

            if ((res.rowCount ?? 0) > 0) totalImported++;
            else totalSkipped++;
          } catch (rowErr) {
            console.error(`   ❌ Lỗi insert [${teacher.code}] video_id=${videoId}: ${rowErr.message}`);
            importErrors.push({ teacher: teacher.code, videoId, error: rowErr.message });
          }
        }

        console.log(`   ✅ [${teacher.code}] ${teacher.full_name || ''} — đã import ${scores.length} bài`);
      }

      await client.query('COMMIT');

    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    }

    // ── Step 8: Báo cáo kết quả ──────────────────────────────────────────────
    console.log('\n' + '═'.repeat(60));
    console.log('📊 KẾT QUẢ BACKFILL:');
    console.log('═'.repeat(60));
    console.log(`   Giáo viên trong bảng teachers    : ${allTeachers.length}`);
    console.log(`   Giáo viên đã có điểm (bỏ qua)   : ${existingCodes.size}`);
    console.log(`   Giáo viên cần import              : ${teachersWithoutScores.length}`);
    console.log(`   Tìm thấy trong sheet              : ${matchedRows.length}`);
    console.log(`   Không có trong sheet              : ${notFoundInSheet.length}`);
    console.log(`   Không có điểm hợp lệ trong sheet  : ${teachersWithNoValidScores}`);
    console.log(`   Điểm đã import vào DB             : ${totalImported}`);
    console.log(`   Điểm bị bỏ qua (đã tốt hơn)      : ${totalSkipped}`);
    if (importErrors.length > 0) {
      console.log(`   ❌ Lỗi insert                     : ${importErrors.length}`);
      for (const e of importErrors) {
        console.log(`      [${e.teacher}] video_id=${e.videoId}: ${e.error}`);
      }
    }
    console.log('═'.repeat(60));
    console.log('✅ Backfill hoàn tất!\n');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('❌ Lỗi không xử lý được:', err);
  process.exit(1);
});
