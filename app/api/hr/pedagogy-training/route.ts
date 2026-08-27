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
  workEmailPrefix: string;
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

type PedagogyScoreRow = {
  teacher_code_norm: string;
  target_ref: 'lesson_1' | 'lesson_2' | 'lesson_3' | 'lesson_4';
  score: string | number | null;
};

const PEDAGOGY_LESSON_REFS = ['lesson_1', 'lesson_2', 'lesson_3', 'lesson_4'] as const;
const COMPLETED_STATUS = 'Đã hoàn thành tập huấn';
const INCOMPLETE_STATUS = 'Chưa hoàn thành tập huấn';

function normalizeTeacherCenter(value: unknown) {
  const center = String(value || '').trim();
  if (!center) return '';
  const normalized = center.toLowerCase().replace(/\s+/g, ' ');
  if (
    normalized === '#n/a' ||
    normalized === 'n/a' ||
    normalized === 'na' ||
    normalized === 'active'
  ) {
    return '';
  }
  return center;
}

function normalizeTeacherCode(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function formatScore(value: number | null) {
  if (value === null || Number.isNaN(value)) return '';
  return value.toFixed(2).replace(/\.?0+$/, '');
}

function parseScoreValue(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text || text === '-' || text.toLowerCase() === '3t') return null;
  const score = Number(text.replace(',', '.'));
  return Number.isFinite(score) ? score : null;
}

function calculateWeightedTotalScore(reviewScoreText: string, theoryScoreText: string) {
  const reviewScore = parseScoreValue(reviewScoreText);
  const theoryScore = parseScoreValue(theoryScoreText);
  if (reviewScore === null || theoryScore === null) return '3T';
  return formatScore(reviewScore * 0.7 + theoryScore * 0.3);
}

function buildScoreKey(teacherCode: unknown, targetRef: unknown) {
  const code = normalizeTeacherCode(teacherCode);
  const lesson = String(targetRef || '').trim();
  return code && lesson ? `${code}::${lesson}` : '';
}

function readLessonScore(
  scoreByTeacherAndLesson: Map<string, number>,
  aliases: string[],
  targetRef: (typeof PEDAGOGY_LESSON_REFS)[number],
) {
  for (const alias of aliases) {
    const score = scoreByTeacherAndLesson.get(buildScoreKey(alias, targetRef));
    if (typeof score === 'number') return score;
  }
  return null;
}

function resolveTrainingStatus(totalScoreText: string, completedLessons: number) {
  // Mirrors the sheet logic: P=1 override is not represented in TPS yet.
  if (totalScoreText === '3T') return INCOMPLETE_STATUS;
  const totalScore = Number(totalScoreText.replace(',', '.'));
  if (completedLessons === 4 && Number.isFinite(totalScore) && totalScore > 5.99) {
    return COMPLETED_STATUS;
  }
  return INCOMPLETE_STATUS;
}

async function getTeacherRows(): Promise<PedagogyTrainingRow[]> {
  const [teacherResult, scoreResult] = await Promise.all([
    pool.query(
      `
    WITH teacher_source AS (
      SELECT
        COALESCE(NULLIF(TRIM(full_name), ''), NULLIF(TRIM("Full name"), '')) AS full_name,
        NULLIF(TRIM(code), '') AS code,
        COALESCE(NULLIF(TRIM(user_name), ''), NULLIF(TRIM("User name"), '')) AS user_name,
        LOWER(TRIM(SPLIT_PART(COALESCE(NULLIF(work_email, ''), NULLIF("Work email", '')), '@', 1))) AS work_email_prefix,
        COALESCE(NULLIF(TRIM(main_centre), ''), NULLIF(TRIM("Main centre"), ''), NULLIF(TRIM(centers), '')) AS center,
        COALESCE(NULLIF(TRIM(status_update), ''), NULLIF(TRIM(status), ''), NULLIF(TRIM(status_check), ''), NULLIF(TRIM("Status"), '')) AS status,
        COALESCE(NULLIF(TRIM(khoi_final), ''), NULLIF(TRIM(course_line), ''), NULLIF(TRIM("Course Line"), '')) AS block
      FROM teachers
    )
    SELECT *
    FROM teacher_source
    WHERE LOWER(TRIM(COALESCE(status, ''))) = 'active'
    ORDER BY COALESCE(NULLIF(TRIM(full_name), ''), NULLIF(TRIM(code), '')) ASC
    `,
    ),
    pool.query<PedagogyScoreRow>(
      `
      SELECT DISTINCT ON (LOWER(TRIM(tas.teacher_code)), tva.target_ref)
        LOWER(TRIM(tas.teacher_code)) AS teacher_code_norm,
        tva.target_ref,
        tas.score
      FROM training_assignment_submissions tas
      INNER JOIN training_video_assignments tva ON tva.id = tas.assignment_id
      WHERE tva.training_stage = 'pedagogy_training'
        AND tva.target_ref = ANY($1::text[])
        AND tas.status = 'graded'
      ORDER BY
        LOWER(TRIM(tas.teacher_code)),
        tva.target_ref,
        tas.score DESC NULLS LAST,
        tas.graded_at DESC NULLS LAST,
        tas.submitted_at DESC NULLS LAST,
        tas.updated_at DESC NULLS LAST
      `,
      [PEDAGOGY_LESSON_REFS],
    ),
  ]);

  const scoreByTeacherAndLesson = new Map<string, number>();
  for (const row of scoreResult.rows) {
    const score = Number(row.score);
    const key = buildScoreKey(row.teacher_code_norm, row.target_ref);
    if (key && Number.isFinite(score)) {
      scoreByTeacherAndLesson.set(key, score);
    }
  }

  return teacherResult.rows.map((teacher, index) => {
    const code = String(teacher.code || '').trim();
    const userName = String(teacher.user_name || '').trim();
    const workEmailPrefix = String(teacher.work_email_prefix || '').trim();
    const aliases = Array.from(
      new Set([code, userName, workEmailPrefix].map(normalizeTeacherCode).filter(Boolean)),
    );
    const lessonScores = PEDAGOGY_LESSON_REFS.map((targetRef) =>
      readLessonScore(scoreByTeacherAndLesson, aliases, targetRef),
    );
    const scoredLessons = lessonScores.filter((score): score is number => score !== null);
    const completedLessons = scoredLessons.length;
    const totalScoreNumber =
      completedLessons > 0
        ? scoredLessons.reduce((sum, score) => sum + score, 0) / completedLessons
        : null;
    const reviewScore70 = '';
    const theoryScore30 = formatScore(totalScoreNumber);
    const totalScore = calculateWeightedTotalScore(reviewScore70, theoryScore30);

    return {
      rowNumber: index + 1,
      key: code || userName || String(index),
      fullName: String(teacher.full_name || '').trim(),
      code,
      userName,
      workEmailPrefix,
      center: normalizeTeacherCenter(teacher.center),
      teacherStatus: String(teacher.status || '').trim(),
      block: String(teacher.block || '').trim(),
      lesson1: formatScore(lessonScores[0]),
      lesson2: formatScore(lessonScores[1]),
      lesson3: formatScore(lessonScores[2]),
      lesson4: formatScore(lessonScores[3]),
      reviewScore70,
      theoryScore30,
      totalScore,
      totalLesson: String(completedLessons),
      trainingStatus: resolveTrainingStatus(totalScore, completedLessons),
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
    const status = row.trainingStatus || INCOMPLETE_STATUS;
    if (status === COMPLETED_STATUS) {
      summary.completed++;
    } else {
      summary.notStarted++;
    }

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
