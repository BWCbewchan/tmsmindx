import type { Pool } from "pg";

const LEGACY_QUOTED_KEYS_SUPERSEDED_BY_SNAKE_CASE = new Set([
  "Full name",
  "User name",
  "Work email",
  "Main centre",
  "Status",
  "Course Line",
]);

export function mergeTeacherRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'onboarding_snapshot') continue;
    if (LEGACY_QUOTED_KEYS_SUPERSEDED_BY_SNAKE_CASE.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export async function findTeacherRowByEmailOrCode(
  pool: Pool,
  opts: { email?: string; code?: string }
): Promise<Record<string, unknown> | null> {
  const email = opts.email?.trim().toLowerCase();
  const code = opts.code?.trim();

  if (email) {
    const r = await pool.query(
      `SELECT * FROM teachers
       WHERE LOWER(TRIM(work_email)) = $1 OR LOWER(TRIM("Work email")) = $1
       LIMIT 1`,
      [email]
    );
    return (r.rows[0] as Record<string, unknown>) || null;
  }

  if (code) {
    const r = await pool.query(
      `SELECT * FROM teachers WHERE
        LOWER(TRIM(code)) = LOWER(TRIM($1))
        OR LOWER(TRIM(COALESCE(user_name, ''))) = LOWER(TRIM($1))
        OR LOWER(TRIM(COALESCE("User name", ''))) = LOWER(TRIM($1))
        OR LOWER(TRIM(SPLIT_PART(COALESCE(work_email, ''), '@', 1))) = LOWER(TRIM($1))
        OR LOWER(TRIM(SPLIT_PART(COALESCE(personal_email, ''), '@', 1))) = LOWER(TRIM($1))
        OR LOWER(TRIM(SPLIT_PART(COALESCE("Work email", ''), '@', 1))) = LOWER(TRIM($1))
       LIMIT 1`,
      [code]
    );
    return (r.rows[0] as Record<string, unknown>) || null;
  }

  return null;
}

export type TeacherLookupCandidate = {
  code: string;
  fullName: string;
  center: string;
};

export type TeacherLookupResult = {
  row: Record<string, unknown> | null;
  /** Nhiều giáo viên khớp — client hiển thị danh sách chọn */
  matches?: TeacherLookupCandidate[];
};

const NAME_LOOKUP_LIMIT = 12;

export function teacherRowToLookupCandidate(
  row: Record<string, unknown>,
): TeacherLookupCandidate | null {
  const code = String(row.code ?? "").trim();
  if (!code) return null;
  const fullName = String(
    row.full_name ?? row["Full name"] ?? row.name ?? "",
  ).trim();
  const center = String(
    row.main_centre ?? row["Main centre"] ?? row.centers ?? row.branch ?? "",
  ).trim();
  return {
    code,
    fullName: fullName || code,
    center: center || "—",
  };
}

function rowsToCandidates(rows: Record<string, unknown>[]): TeacherLookupCandidate[] {
  const seen = new Set<string>();
  const out: TeacherLookupCandidate[] = [];
  for (const row of rows) {
    const c = teacherRowToLookupCandidate(row);
    if (!c || seen.has(c.code.toLowerCase())) continue;
    seen.add(c.code.toLowerCase());
    out.push(c);
  }
  return out;
}

/** Tìm theo mã/username/email trước, sau đó theo họ tên (khớp chính xác hoặc một phần). */
export async function findTeacherRowByLookupQuery(
  pool: Pool,
  query: string,
): Promise<TeacherLookupResult> {
  const q = query.trim();
  if (!q) return { row: null };

  const byCode = await findTeacherRowByEmailOrCode(pool, { code: q });
  if (byCode) return { row: byCode };

  const exact = await pool.query(
    `SELECT * FROM teachers
     WHERE LOWER(TRIM(COALESCE(full_name, ''))) = LOWER(TRIM($1))
        OR LOWER(TRIM(COALESCE("Full name", ''))) = LOWER(TRIM($1))
     ORDER BY LENGTH(COALESCE(full_name, COALESCE("Full name", ''))) ASC
     LIMIT ${NAME_LOOKUP_LIMIT}`,
    [q],
  );
  const exactCandidates = rowsToCandidates(
    exact.rows as Record<string, unknown>[],
  );
  if (exactCandidates.length === 1) {
    return { row: exact.rows[0] as Record<string, unknown> };
  }
  if (exactCandidates.length > 1) {
    return { row: null, matches: exactCandidates };
  }

  const partial = await pool.query(
    `SELECT * FROM teachers
     WHERE LOWER(TRIM(COALESCE(full_name, ''))) LIKE '%' || LOWER(TRIM($1)) || '%'
        OR LOWER(TRIM(COALESCE("Full name", ''))) LIKE '%' || LOWER(TRIM($1)) || '%'
     ORDER BY LENGTH(COALESCE(full_name, COALESCE("Full name", ''))) ASC
     LIMIT ${NAME_LOOKUP_LIMIT}`,
    [q],
  );
  const partialCandidates = rowsToCandidates(
    partial.rows as Record<string, unknown>[],
  );
  if (partialCandidates.length === 1) {
    return { row: partial.rows[0] as Record<string, unknown> };
  }
  if (partialCandidates.length > 1) {
    return { row: null, matches: partialCandidates };
  }

  return { row: null };
}

/** Gom mã GV dùng để khớp `chuyen_sau_results.ma_giao_vien` (đôi khi trùng `code`, đôi khi chỉ trùng `user_name`). */
function collectTeacherCodeAliases(code: string, alternateCodes?: string[]): string[] {
  const set = new Set<string>();
  const add = (s: string | undefined) => {
    const t = String(s ?? "").trim().toLowerCase();
    if (t) set.add(t);
  };
  add(code);
  alternateCodes?.forEach(add);
  return [...set];
}

/** Chuyên sâu — cùng logic với /api/rawdata */
export async function fetchExpertiseBundleByCode(
  pool: Pool,
  code: string,
  alternateCodes?: string[]
) {
  const client = await pool.connect();
  try {
    const codeAliases = collectTeacherCodeAliases(code, alternateCodes);
    console.log('🔍 Fetching expertise for:', { code, alternateCodes, codeAliases });
    
    if (codeAliases.length === 0) {
      console.log('⚠️ No code aliases found');
      return {
        records: [],
        monthlyData: [],
        totalRecords: 0,
        teacherCode: code.trim(),
      };
    }

    const result = await client.query(
      `SELECT
         r.khu_vuc            AS area,
         r.ho_ten             AS name,
         r.dia_chi_email      AS email,
         COALESCE(mh.ten_mon, mh.ma_mon, r.id_mon::text, '') AS subject,
         r.co_so_lam_viec     AS branch,
         r.ma_giao_vien       AS code,
         r.hinh_thuc          AS type,
         -- Ưu tiên lich_thi_dk nếu có (chính xác nhất); fallback sang thang_dk/nam_dk, cuối cùng là tao_luc
         COALESCE(EXTRACT(MONTH FROM r.lich_thi_dk)::int, r.thang_dk, EXTRACT(MONTH FROM r.tao_luc)::int) AS month,
         COALESCE(EXTRACT(YEAR  FROM r.lich_thi_dk)::int, r.nam_dk,   EXTRACT(YEAR  FROM r.tao_luc)::int) AS year,
         r.dot                AS batch,
         r.thoi_gian_kiem_tra AS time,
         r.cau_dung           AS correct,
         r.diem               AS score,
         r.email_giai_trinh   AS email_explanation,
         r.xu_ly_diem         AS processing,
         r.lich_thi_dk,
         r.thang_dk,
         r.nam_dk,
         r.tao_luc,
         EXISTS (
           SELECT 1 FROM chuyen_sau_giaitrinh g
           WHERE g.id_ket_qua = r.id
             AND g.xu_ly_giai_trinh = 'đã duyệt'
           LIMIT 1
         ) AS has_accepted_explanation
       FROM chuyen_sau_results r
       LEFT JOIN chuyen_sau_monhoc mh ON mh.id = r.id_mon
       WHERE r.diem IS NOT NULL
         AND r.xu_ly_diem IS NOT NULL  -- chỉ lấy bài đã xử lý (đã thi hoặc chờ giải trình)
         AND COALESCE(mh.loai_ky_thi, 'expertise') = 'expertise'  -- CHỈ lấy kiểm tra chuyên sâu, không lấy trải nghiệm
         AND (
           LOWER(TRIM(COALESCE(r.ma_giao_vien, ''))) = ANY($1::text[])
           OR LOWER(TRIM(SPLIT_PART(COALESCE(r.dia_chi_email, ''), '@', 1))) = ANY($1::text[])
         )
       ORDER BY year DESC, month DESC`,
      [codeAliases]
    );

    console.log('📊 Raw query result rows:', result.rows.length);
    console.log('📊 Sample rows:', result.rows.slice(0, 3));

    type TestRecord = {
      area: string;
      name: string;
      email: string;
      subject: string;
      branch: string;
      code: string;
      type: string;
      month: string;
      year: string;
      batch: string;
      time: string;
      exam: string;
      correct: string;
      score: string;
      emailExplanation: string;
      processing: string;
      date: string;
      isCountedInAverage: boolean;
    };

    type MonthlyAverage = {
      month: string;
      average: number;
      count: number;
      records: TestRecord[];
    };

    const records: TestRecord[] = result.rows.map((row: Record<string, unknown>) => {
      const score = parseFloat(String(row.score ?? "0")) || 0;
      // Tính vào trung bình nếu có điểm thực > 0, HOẶC chưa submit nhưng không được miễn
      // Tính vào trung bình nếu chưa được miễn bởi giải trình đã duyệt
      // Bài thi 0 điểm chưa giải trình vẫn tính 0, bài được miễn thì bỏ qua
      const isCountedInAverage = !row.has_accepted_explanation;
      const m = parseInt(String(row.month ?? "").trim(), 10);
      const y = parseInt(String(row.year ?? "").trim(), 10);
      const dateStr =
        Number.isFinite(m) && Number.isFinite(y) ? `${m}/${y}` : `${row.month}/${row.year}`;

      return {
        area: String(row.area ?? ""),
        name: String(row.name ?? ""),
        email: String(row.email ?? ""),
        subject: String(row.subject ?? ""),
        branch: String(row.branch ?? ""),
        code: String(row.code ?? ""),
        type: String(row.type ?? ""),
        month: String(row.month ?? ""),
        year: String(row.year ?? ""),
        batch: String(row.batch ?? ""),
        time: String(row.time ?? ""),
        exam: "",
        correct: String(row.correct ?? "0"),
        score: String(score),
        emailExplanation: String(row.email_explanation ?? ""),
        processing: String(row.processing ?? ""),
        date: dateStr,
        isCountedInAverage,
      };
    });

    console.log('📊 Processed records:', records.length);
    console.log('📊 Recent records:', records.slice(0, 5).map(r => ({
      subject: r.subject,
      date: r.date,
      score: r.score,
      type: r.type,
      isCountedInAverage: r.isCountedInAverage
    })));

    const monthlyMap = new Map<string, TestRecord[]>();
    records.forEach((record) => {
      if (!monthlyMap.has(record.date)) monthlyMap.set(record.date, []);
      monthlyMap.get(record.date)!.push(record);
    });

    const monthlyData: MonthlyAverage[] = [];
    monthlyMap.forEach((monthRecords, month) => {
      // Nhóm theo môn học trong tháng — cùng công thức với /api/rawdata
      const subjectMap = new Map<string, TestRecord[]>();
      monthRecords.forEach((r) => {
        const subjectKey = r.subject || '__unknown__';
        if (!subjectMap.has(subjectKey)) subjectMap.set(subjectKey, []);
        subjectMap.get(subjectKey)!.push(r);
      });

      let totalCombinedScore = 0;
      let subjectCount = 0;

      subjectMap.forEach((subjectRecords) => {
        // Chỉ tính môn có ít nhất một record được tính vào trung bình
        if (!subjectRecords.some((r) => r.isCountedInAverage)) return;

        let officialScore = 0;
        let supplementScore = 0;
        let hasOfficial = false;
        let hasSupplement = false;

        subjectRecords.forEach((r) => {
          if (!r.isCountedInAverage) return;
          const typeLower = (r.type || '').toLowerCase();
          const isSupplement =
            typeLower.includes('bổ sung') ||
            typeLower.includes('bo sung') ||
            typeLower === 'additional';
          const score = parseFloat(r.score);
          if (isSupplement) {
            supplementScore = score;
            hasSupplement = true;
          } else {
            officialScore = score;
            hasOfficial = true;
          }
        });

        // Công thức: (chính thức + bổ sung) / 2 nếu có cả hai, ngược lại lấy điểm có sẵn
        const combinedScore =
          hasOfficial && hasSupplement
            ? (officialScore + supplementScore) / 2
            : hasSupplement
              ? supplementScore
              : officialScore;

        totalCombinedScore += combinedScore;
        subjectCount++;
      });

      if (subjectCount > 0) {
        const average = totalCombinedScore / subjectCount;
        monthlyData.push({ month, average, count: subjectCount, records: monthRecords });
      } else {
        monthlyData.push({ month, average: 0, count: 0, records: monthRecords });
      }
    });

    monthlyData.sort((a, b) => {
      const [monthA, yearA] = a.month.split("/").map(Number);
      const [monthB, yearB] = b.month.split("/").map(Number);
      if (yearA !== yearB) return yearB - yearA;
      return monthB - monthA;
    });

    return {
      records,
      monthlyData,
      totalRecords: records.length,
      teacherCode: code,
    };
  } finally {
    client.release();
  }
}

const CSV_URL = process.env.NEXT_PUBLIC_RAWDATA_EXPERIENCE_CSV_URL || "";

/**
 * Trải nghiệm từ DB — query chuyen_sau_results với loai_ky_thi = 'experience'.
 * Dùng cùng logic tính điểm như fetchExpertiseBundleByCode.
 */
export async function fetchExperienceDbBundleByCode(
  pool: Pool,
  code: string,
  alternateCodes?: string[]
) {
  const client = await pool.connect();
  try {
    const codeAliases: string[] = [];
    const addAlias = (s: string | undefined) => {
      const t = String(s ?? "").trim().toLowerCase();
      if (t) codeAliases.push(t);
    };
    addAlias(code);
    alternateCodes?.forEach(addAlias);

    if (codeAliases.length === 0) {
      return { records: [], monthlyData: [], totalRecords: 0, teacherCode: code };
    }

    const result = await client.query(
      `SELECT
         r.khu_vuc            AS area,
         r.ho_ten             AS name,
         r.dia_chi_email      AS email,
         COALESCE(mh.ten_mon, mh.ma_mon, r.id_mon::text, '') AS subject,
         r.co_so_lam_viec     AS branch,
         r.ma_giao_vien       AS code,
         r.hinh_thuc          AS type,
         COALESCE(EXTRACT(MONTH FROM r.lich_thi_dk)::int, r.thang_dk, EXTRACT(MONTH FROM r.tao_luc)::int) AS month,
         COALESCE(EXTRACT(YEAR  FROM r.lich_thi_dk)::int, r.nam_dk,   EXTRACT(YEAR  FROM r.tao_luc)::int) AS year,
         r.dot                AS batch,
         r.thoi_gian_kiem_tra AS time,
         r.cau_dung           AS correct,
         r.diem               AS score,
         r.email_giai_trinh   AS email_explanation,
         r.xu_ly_diem         AS processing,
         r.lich_thi_dk,
         r.thang_dk,
         r.nam_dk,
         r.tao_luc,
         EXISTS (
           SELECT 1 FROM chuyen_sau_giaitrinh g
           WHERE g.id_ket_qua = r.id
             AND g.xu_ly_giai_trinh = 'đã duyệt'
           LIMIT 1
         ) AS has_accepted_explanation
       FROM chuyen_sau_results r
       LEFT JOIN chuyen_sau_monhoc mh ON mh.id = r.id_mon
       WHERE r.diem IS NOT NULL
         AND r.xu_ly_diem IS NOT NULL
         AND COALESCE(mh.loai_ky_thi, 'expertise') = 'experience'  -- CHỈ lấy kiểm tra trải nghiệm
         AND (
           LOWER(TRIM(COALESCE(r.ma_giao_vien, ''))) = ANY($1::text[])
           OR LOWER(TRIM(SPLIT_PART(COALESCE(r.dia_chi_email, ''), '@', 1))) = ANY($1::text[])
         )
       ORDER BY year DESC, month DESC`,
      [codeAliases]
    );

    type DbRecord = {
      area: string; name: string; email: string; subject: string;
      branch: string; code: string; type: string; month: string; year: string;
      batch: string; time: string; correct: string; score: string;
      emailExplanation: string; processing: string; date: string;
      isCountedInAverage: boolean;
    };

    const records: DbRecord[] = result.rows.map((row: Record<string, unknown>) => {
      const m = parseInt(String(row.month ?? "").trim(), 10);
      const y = parseInt(String(row.year ?? "").trim(), 10);
      const dateStr = Number.isFinite(m) && Number.isFinite(y) ? `${m}/${y}` : `${row.month}/${row.year}`;
      return {
        area: String(row.area ?? ""),
        name: String(row.name ?? ""),
        email: String(row.email ?? ""),
        subject: String(row.subject ?? ""),
        branch: String(row.branch ?? ""),
        code: String(row.code ?? ""),
        type: String(row.type ?? ""),
        month: String(m || ""),
        year: String(y || ""),
        batch: String(row.batch ?? ""),
        time: String(row.time ?? ""),
        correct: String(row.correct ?? "0"),
        score: String(parseFloat(String(row.score ?? "0")) || 0),
        emailExplanation: String(row.email_explanation ?? ""),
        processing: String(row.processing ?? ""),
        date: dateStr,
        isCountedInAverage: !row.has_accepted_explanation,
      };
    });

    const monthlyMap = new Map<string, DbRecord[]>();
    records.forEach((r) => {
      if (!monthlyMap.has(r.date)) monthlyMap.set(r.date, []);
      monthlyMap.get(r.date)!.push(r);
    });

    type MonthlyAvg = { month: string; average: number; count: number; records: DbRecord[] };
    const monthlyData: MonthlyAvg[] = [];
    monthlyMap.forEach((monthRecords, month) => {
      const counted = monthRecords.filter((r) => r.isCountedInAverage);
      if (counted.length > 0) {
        const sum = counted.reduce((acc, r) => acc + parseFloat(r.score), 0);
        monthlyData.push({ month, average: sum / counted.length, count: counted.length, records: monthRecords });
      } else {
        monthlyData.push({ month, average: 0, count: 0, records: monthRecords });
      }
    });

    monthlyData.sort((a, b) => {
      const [mA, yA] = a.month.split("/").map(Number);
      const [mB, yB] = b.month.split("/").map(Number);
      if (yA !== yB) return yB - yA;
      return mB - mA;
    });

    return { records, monthlyData, totalRecords: records.length, teacherCode: code };
  } finally {
    client.release();
  }
}

/** Trải nghiệm — cùng logic với /api/rawdata-experience */
export async function fetchExperienceBundleByCode(code: string) {
  type TestRecord = {
    area: string;
    name: string;
    email: string;
    branch: string;
    code: string;
    type: string;
    teachingLevel: string;
    month: string;
    year: string;
    batch: string;
    time: string;
    correct: string;
    score: string;
    emailExplanation: string;
    processing: string;
    date: string;
    isCountedInAverage: boolean;
  };

  type MonthlyAverage = {
    month: string;
    average: number;
    count: number;
    records: TestRecord[];
  };

  if (!CSV_URL) {
    return { records: [] as TestRecord[], monthlyData: [] as MonthlyAverage[], totalRecords: 0, teacherCode: code };
  }

  const response = await fetch(CSV_URL);
  const csvText = await response.text();
  const lines = csvText.split("\n");
  const records: TestRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns: string[] = [];
    let currentColumn = "";
    let insideQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === "," && !insideQuotes) {
        columns.push(currentColumn);
        currentColumn = "";
      } else {
        currentColumn += char;
      }
    }
    columns.push(currentColumn);

    const teacherCode = columns[4]?.trim().toLowerCase();
    if (teacherCode !== code.toLowerCase()) continue;

    const score = parseFloat(columns[12]?.replace(",", ".") || "0");
    const emailExplanation = columns[13]?.trim() || "";

    let dateStr = columns[15]?.trim();
    if (!dateStr && columns[7] && columns[8]) {
      dateStr = `${columns[7]}/${columns[8]}`;
    }

    const isCountedInAverage = !(score === 0 && emailExplanation !== "");

    records.push({
      area: columns[0]?.trim() || "",
      name: columns[1]?.trim() || "",
      email: columns[2]?.trim() || "",
      branch: columns[3]?.trim() || "",
      code: columns[4]?.trim() || "",
      type: columns[5]?.trim() || "",
      teachingLevel: columns[6]?.trim() || "",
      month: columns[7]?.trim() || "",
      year: columns[8]?.trim() || "",
      batch: columns[9]?.trim() || "",
      time: columns[10]?.trim() || "",
      correct: columns[11]?.trim() || "",
      score: columns[12]?.trim() || "0",
      emailExplanation,
      processing: columns[14]?.trim() || "",
      date: dateStr || "",
      isCountedInAverage,
    });
  }

  records.sort((a, b) => {
    const yearA = parseInt(a.year) || 0;
    const yearB = parseInt(b.year) || 0;
    if (yearA !== yearB) return yearB - yearA;
    const monthA = parseInt(a.month) || 0;
    const monthB = parseInt(b.month) || 0;
    return monthB - monthA;
  });

  const monthlyMap = new Map<string, TestRecord[]>();
  records.forEach((record) => {
    if (!monthlyMap.has(record.date)) monthlyMap.set(record.date, []);
    monthlyMap.get(record.date)!.push(record);
  });

  const monthlyData: MonthlyAverage[] = [];
  monthlyMap.forEach((monthRecords, month) => {
    const countedRecords = monthRecords.filter((r) => r.isCountedInAverage);
    if (countedRecords.length > 0) {
      const sum = countedRecords.reduce((acc, r) => acc + parseFloat(r.score.replace(",", ".")), 0);
      const average = sum / countedRecords.length;
      monthlyData.push({ month, average, count: countedRecords.length, records: monthRecords });
    } else {
      monthlyData.push({ month, average: 0, count: 0, records: monthRecords });
    }
  });

  monthlyData.sort((a, b) => {
    const [monthA, yearA] = a.month.split("/").map(Number);
    const [monthB, yearB] = b.month.split("/").map(Number);
    if (yearA !== yearB) return yearB - yearA;
    return monthB - monthA;
  });

  return {
    records,
    monthlyData,
    totalRecords: records.length,
    teacherCode: code,
  };
}

export async function fetchCertificatesByEmail(pool: Pool, teacherEmail: string) {
  const result = await pool.query(
    `SELECT * FROM teacher_certificates
     WHERE teacher_email = $1
     ORDER BY created_at DESC`,
    [teacherEmail]
  );
  return { success: true as const, data: result.rows, count: result.rows.length };
}

export async function fetchTrainingRowByCode(pool: Pool, teacherCode: string) {
  const result = await pool.query(
    `SELECT
        t.code as teacher_code,
        t.full_name,
        t.user_name as username,
        t.work_email,
        COALESCE(t.main_centre, t.centers) as center,
        COALESCE(t.status, t.status_check, t.status_update, 'Active') as teacher_status,
        COALESCE(tts.total_score, 0) as total_score,
        COALESCE(tts.total_videos_assigned, 0) as total_videos_assigned,
        COALESCE(tts.videos_completed, 0) as videos_completed,
        COALESCE(tts.avg_video_score, 0) as avg_video_score,
        COALESCE(tts.total_assignments_taken, 0) as total_assignments_taken,
        COALESCE(tts.assignments_passed, 0) as assignments_passed,
        COALESCE(tts.avg_assignment_score, 0) as avg_assignment_score
      FROM teachers t
      LEFT JOIN training_teacher_stats tts ON t.code = tts.teacher_code
      WHERE t.code = $1
      LIMIT 1`,
    [teacherCode]
  );
  return { success: true as const, data: result.rows, count: result.rows.length };
}

export type TeacherProfileBundle = {
  exists: boolean;
  teacher: Record<string, unknown> | null;
  expertise: Awaited<ReturnType<typeof fetchExpertiseBundleByCode>> | null;
  experience: Awaited<ReturnType<typeof fetchExperienceBundleByCode>> | null;
  certificates: Awaited<ReturnType<typeof fetchCertificatesByEmail>> | null;
  training: Awaited<ReturnType<typeof fetchTrainingRowByCode>> | null;
};

/**
 * Chỉ tải chuyên sâu + trải nghiệm (query/CSV nặng). Dùng sau khi đã có `teacher.code` từ bundle nhanh.
 * Trải nghiệm = merge dữ liệu từ DB (loai_ky_thi='experience') + CSV (Google Sheet).
 */
export async function loadTeacherScoresOnly(
  pool: Pool,
  code: string,
  opts?: { alternateCodes?: string[] }
) {
  const trimmed = code.trim();
  if (!trimmed) {
    return {
      expertise: null as Awaited<ReturnType<typeof fetchExpertiseBundleByCode>> | null,
      experience: null as Awaited<ReturnType<typeof fetchExperienceBundleByCode>> | null,
    };
  }
  const alt = opts?.alternateCodes?.filter((c) => String(c).trim()) ?? [];
  const [expertise, csvExperience, dbExperience] = await Promise.all([
    fetchExpertiseBundleByCode(pool, trimmed, alt).catch(() => null),
    fetchExperienceBundleByCode(trimmed).catch(() => null),
    fetchExperienceDbBundleByCode(pool, trimmed, alt).catch(() => null),
  ]);

  // Merge dữ liệu trải nghiệm từ CSV và DB
  let experience = csvExperience;
  if (dbExperience && dbExperience.records.length > 0) {
    const csvRecords = csvExperience?.records ?? [];
    const dbRecords = dbExperience.records;

    // Gộp tất cả records
    const allRecords = [...csvRecords, ...dbRecords];

    // Rebuild monthlyData từ allRecords
    type MergedRecord = (typeof allRecords)[0];
    const monthlyMap = new Map<string, MergedRecord[]>();
    allRecords.forEach((r) => {
      if (!monthlyMap.has(r.date)) monthlyMap.set(r.date, []);
      monthlyMap.get(r.date)!.push(r);
    });

    type MonthlyAvg = { month: string; average: number; count: number; records: MergedRecord[] };
    const monthlyData: MonthlyAvg[] = [];
    monthlyMap.forEach((monthRecords, month) => {
      const counted = monthRecords.filter((r) => r.isCountedInAverage);
      if (counted.length > 0) {
        const sum = counted.reduce((acc, r) => acc + parseFloat(String(r.score).replace(",", ".")), 0);
        monthlyData.push({ month, average: sum / counted.length, count: counted.length, records: monthRecords });
      } else {
        monthlyData.push({ month, average: 0, count: 0, records: monthRecords });
      }
    });

    monthlyData.sort((a, b) => {
      const [mA, yA] = a.month.split("/").map(Number);
      const [mB, yB] = b.month.split("/").map(Number);
      if (yA !== yB) return yB - yA;
      return mB - mA;
    });

    experience = {
      records: allRecords,
      monthlyData,
      totalRecords: allRecords.length,
      teacherCode: trimmed,
    } as typeof csvExperience;
  }

  return { expertise, experience };
}

export async function loadTeacherProfileBundle(
  pool: Pool,
  opts: { email?: string; code?: string; fast?: boolean }
): Promise<TeacherProfileBundle> {
  const { fast, ...lookup } = opts;
  let raw: Record<string, unknown> | null = null;
  if (lookup.email) {
    raw = await findTeacherRowByEmailOrCode(pool, lookup);
  } else if (lookup.code) {
    raw = (await findTeacherRowByLookupQuery(pool, lookup.code)).row;
  }
  if (!raw) {
    return {
      exists: false,
      teacher: null,
      expertise: null,
      experience: null,
      certificates: null,
      training: null,
    };
  }

  const teacher = mergeTeacherRow(raw);
  const code = String(teacher.code ?? "").trim();
  const workEmail = String(teacher.work_email ?? teacher["Work email"] ?? "").trim();
  const userName = String(teacher.user_name ?? "").trim();
  const expertiseAliases = userName ? [userName] : [];

  if (fast) {
    const [certificates, training] = await Promise.all([
      workEmail
        ? fetchCertificatesByEmail(pool, workEmail).catch(() => null)
        : Promise.resolve(null),
      code ? fetchTrainingRowByCode(pool, code).catch(() => null) : Promise.resolve(null),
    ]);
    return {
      exists: true,
      teacher,
      expertise: null,
      experience: null,
      certificates,
      training,
    };
  }

  const [expertise, csvExperience, dbExperience, certificates, training] = await Promise.all([
    code
      ? fetchExpertiseBundleByCode(pool, code, expertiseAliases).catch(() => null)
      : Promise.resolve(null),
    code ? fetchExperienceBundleByCode(code).catch(() => null) : Promise.resolve(null),
    code ? fetchExperienceDbBundleByCode(pool, code, expertiseAliases).catch(() => null) : Promise.resolve(null),
    workEmail
      ? fetchCertificatesByEmail(pool, workEmail).catch(() => null)
      : Promise.resolve(null),
    code ? fetchTrainingRowByCode(pool, code).catch(() => null) : Promise.resolve(null),
  ]);

  // Merge trải nghiệm CSV + DB
  let experience = csvExperience;
  if (dbExperience && dbExperience.records.length > 0) {
    const csvRecords = csvExperience?.records ?? [];
    const allRecords = [...csvRecords, ...dbExperience.records];
    type MergedRecord = (typeof allRecords)[0];
    const monthlyMap = new Map<string, MergedRecord[]>();
    allRecords.forEach((r) => {
      if (!monthlyMap.has(r.date)) monthlyMap.set(r.date, []);
      monthlyMap.get(r.date)!.push(r);
    });
    type MonthlyAvg = { month: string; average: number; count: number; records: MergedRecord[] };
    const monthlyData: MonthlyAvg[] = [];
    monthlyMap.forEach((monthRecords, month) => {
      const counted = monthRecords.filter((r) => r.isCountedInAverage);
      if (counted.length > 0) {
        const sum = counted.reduce((acc, r) => acc + parseFloat(String(r.score).replace(",", ".")), 0);
        monthlyData.push({ month, average: sum / counted.length, count: counted.length, records: monthRecords });
      } else {
        monthlyData.push({ month, average: 0, count: 0, records: monthRecords });
      }
    });
    monthlyData.sort((a, b) => {
      const [mA, yA] = a.month.split("/").map(Number);
      const [mB, yB] = b.month.split("/").map(Number);
      if (yA !== yB) return yB - yA;
      return mB - mA;
    });
    experience = { records: allRecords, monthlyData, totalRecords: allRecords.length, teacherCode: code } as typeof csvExperience;
  }

  return {
    exists: true,
    teacher,
    expertise,
    experience,
    certificates,
    training,
  };
}
