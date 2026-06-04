import { withApiProtection } from '@/lib/api-protection';
import { requireBearerSession } from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { validateHrOnboardingAccess } from '@/lib/hr-onboarding-access';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type PedagogyTrainingRow = {
  rowNumber: number;
  key: string;
  fullName: string;
  code: string;
  userName: string;
  center: string;
  teacherStatus: string;
  block: string;
  lesson1: string;
  lesson2: string;
  lesson3: string;
  lesson4: string;
  reviewScore70: string;
  theoryScore30: string;
  totalScore: string;
  totalLesson: string;
  trainingStatus: string;
};

async function getTeacherRows(): Promise<PedagogyTrainingRow[]> {
  const result = await pool.query(
    `
    SELECT
      COALESCE(NULLIF(TRIM(full_name), ''), NULLIF(TRIM("Full name"), '')) AS full_name,
      NULLIF(TRIM(code), '') AS code,
      COALESCE(NULLIF(TRIM(user_name), ''), NULLIF(TRIM("User name"), '')) AS user_name,
      COALESCE(NULLIF(TRIM(main_centre), ''), NULLIF(TRIM("Main centre"), ''), NULLIF(TRIM(centers), '')) AS center,
      COALESCE(NULLIF(TRIM(status), ''), NULLIF(TRIM(status_check), ''), NULLIF(TRIM(status_update), ''), NULLIF(TRIM("Status"), '')) AS status,
      COALESCE(NULLIF(TRIM(khoi_final), ''), NULLIF(TRIM(course_line), ''), NULLIF(TRIM("Course Line"), '')) AS block
    FROM teachers
    ORDER BY COALESCE(NULLIF(TRIM(full_name), ''), NULLIF(TRIM("Full name"), ''), NULLIF(TRIM(code), '')) ASC
    `,
  );

  return result.rows.map((teacher, index) => {
    const code = String(teacher.code || '').trim();
    const userName = String(teacher.user_name || '').trim();
    return {
      rowNumber: index + 1,
      key: code || userName || String(index),
      fullName: String(teacher.full_name || '').trim(),
      code,
      userName,
      center: String(teacher.center || '').trim(),
      teacherStatus: String(teacher.status || '').trim(),
      block: String(teacher.block || '').trim(),
      lesson1: '',
      lesson2: '',
      lesson3: '',
      lesson4: '',
      reviewScore70: '',
      theoryScore30: '',
      totalScore: '',
      totalLesson: '',
      trainingStatus: '',
    };
  });
}

function buildSummaryFromRows(rows: PedagogyTrainingRow[]) {
  const summary = {
    total: rows.length,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    completionRate: 0,
    averageScore: null,
    byGen: {} as Record<string, number>,
    byRegion: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
  };

  for (const row of rows) {
    const status = row.trainingStatus || 'Chưa có dữ liệu tập huấn';
    summary.notStarted++;

    const center = row.center || 'Chưa rõ cơ sở';
    const block = row.block || 'Chưa rõ khối';
    summary.byGen[center] = (summary.byGen[center] || 0) + 1;
    summary.byRegion[block] = (summary.byRegion[block] || 0) + 1;
    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
  }

  summary.completionRate = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
  return summary;
}

export const GET = withApiProtection(async (request: NextRequest) => {
  const auth = await requireBearerSession(request);
  if (!auth.ok) return auth.response;

  if (!(await validateHrOnboardingAccess(auth.sessionEmail))) {
    return NextResponse.json({ error: 'Bạn không có quyền truy cập module HR.' }, { status: 403 });
  }

  try {
    const rows = await getTeacherRows();
    return NextResponse.json({
      success: true,
      fetchedAt: new Date().toISOString(),
      rows,
      lessonStats: [],
      summary: buildSummaryFromRows(rows),
    });
  } catch (error) {
    console.error('Pedagogy training sheet error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lỗi không xác định khi đọc sheet.' },
      { status: 500 },
    );
  }
});
