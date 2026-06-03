import pool from '@/lib/db';
import { requireBearerAdminOrSuperMutation } from '@/lib/auth-server';
import {
  effectiveCompletionForGroupedLesson,
  type TrainingVideoScoreRow,
} from '@/lib/training-effective-video-completion';
import { deleteQuestionImagesSilently } from '@/lib/question-image-storage';
import { NextRequest, NextResponse } from 'next/server';

const ASSIGNMENT_UPDATE_COLUMNS: Record<string, string> = {
  video_id: 'video_id',
  assignment_title: 'assignment_title',
  assignment_type: 'assignment_type',
  description: 'description',
};

/** XÃ³a áº£nh S3 an toÃ n, khÃ´ng throw */
function parseQuestionOptions(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// GET: Láº¥y danh sÃ¡ch assignments
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const video_id = searchParams.get('video_id');
    // Normalize teacher_code: lowercase + trim Ä‘á»ƒ trÃ¡nh case mismatch
    const teacher_code = (searchParams.get('teacher_code') || '').toLowerCase().trim() || null;
    // status column Ä‘Ã£ bá»‹ xÃ³a (migration V42) â€” khÃ´ng dÃ¹ng ná»¯a

    const quizEvidenceByVideoQuery = `
      SELECT DISTINCT tva.video_id
      FROM training_assignment_submissions tas
      INNER JOIN training_video_assignments tva ON tva.id = tas.assignment_id
      WHERE LOWER(TRIM(tas.teacher_code)) = $1
        AND tva.video_id IS NOT NULL
        AND (
          tas.status = 'graded'
          OR (tas.submitted_at IS NOT NULL AND tas.status IN ('submitted', 'graded'))
        )
    `;

    let query = `
      SELECT 
        a.*, 
        v.title as video_title, 
        v.lesson_number
      FROM training_video_assignments a
      LEFT JOIN training_videos v ON a.video_id = v.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (id) {
      params.push(id);
      conditions.push(`a.id = $${params.length}`);
    }
    if (video_id) {
      params.push(video_id);
      conditions.push(`a.video_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY v.lesson_number ASC NULLS LAST, a.created_at DESC';

    const [result, quizEvidenceResult] = await Promise.all([
      pool.query(query, params),
      teacher_code
        ? pool.query(quizEvidenceByVideoQuery, [teacher_code])
        : Promise.resolve({ rows: [] as { video_id: number }[] }),
    ]);

    const quizEvidenceVideoIds = new Set<number>(
      (quizEvidenceResult.rows as { video_id: number }[]).map((r) => r.video_id),
    );

    // Láº¥y sá»‘ lÆ°á»£ng cÃ¢u há»i cho má»—i assignment
    if (result.rows.length > 0) {
      const assignmentIds = result.rows.map(row => row.id);

      const questionsResult = await pool.query(
        `SELECT assignment_id, COUNT(*) as question_count
         FROM training_assignment_questions
         WHERE assignment_id = ANY($1)
         GROUP BY assignment_id`,
        [assignmentIds]
      );

      const questionCounts = questionsResult.rows.reduce((acc, row) => {
        acc[row.assignment_id] = parseInt(row.question_count);
        return acc;
      }, {} as Record<number, number>);

      // Fetch teacher submissions náº¿u cÃ³ teacher_code
      const submissionsMap: Record<number, any> = {};
      if (teacher_code) {
        const submissionsResult = await pool.query(
          `SELECT DISTINCT ON (assignment_id) *
           FROM training_assignment_submissions
           WHERE LOWER(TRIM(teacher_code)) = $1 AND assignment_id = ANY($2)
             AND status IN ('submitted', 'graded')
           ORDER BY assignment_id, submitted_at DESC NULLS LAST`,
          [teacher_code, assignmentIds]
        );
        submissionsResult.rows.forEach(sub => {
          submissionsMap[sub.assignment_id] = sub;
        });
      }

      type VideoMetaRow = {
        id: number
        video_group_id: string | null
        chunk_index: number | null
        duration_minutes: number | null
        duration_seconds: number | null
      };

      let expandedVideoRows: VideoMetaRow[] = [];
      const scoresMapAll = new Map<number, TrainingVideoScoreRow>();

      if (teacher_code) {
        const assignmentVideoIds = [
          ...new Set(
            result.rows
              .map((r: { video_id?: number | null }) => r.video_id)
              .filter((id): id is number => typeof id === 'number' && id > 0),
          ),
        ];

        if (assignmentVideoIds.length > 0) {
          const expandedRes = await pool.query<VideoMetaRow>(
            `SELECT id, video_group_id, chunk_index, duration_minutes, duration_seconds
             FROM training_videos
             WHERE id = ANY($1::int[])
                OR video_group_id IN (
                  SELECT DISTINCT video_group_id FROM training_videos
                  WHERE id = ANY($1::int[]) AND video_group_id IS NOT NULL
                )
             ORDER BY video_group_id NULLS LAST, chunk_index NULLS LAST, id`,
            [assignmentVideoIds],
          );
          expandedVideoRows = expandedRes.rows;

          const allScoreVideoIds = [
            ...new Set(expandedVideoRows.map((r) => r.id)),
          ];
          if (allScoreVideoIds.length > 0) {
            const scoresRes = await pool.query(
              `SELECT video_id, score, completion_status, completed_at, time_spent_seconds,
                      COALESCE(server_time_seconds, 0) AS server_time_seconds,
                      last_heartbeat_at
               FROM training_teacher_video_scores
               WHERE LOWER(TRIM(teacher_code)) = $1 AND video_id = ANY($2::int[])`,
              [teacher_code, allScoreVideoIds],
            );
            scoresRes.rows.forEach(
              (srow: {
                video_id: number
                score: unknown
                completion_status: string
                completed_at: unknown
                time_spent_seconds: number | null
                server_time_seconds: number | null
                last_heartbeat_at: string | Date | null
              }) => {
                scoresMapAll.set(srow.video_id, {
                  score: parseFloat(String(srow.score)) || 0,
                  completion_status: srow.completion_status,
                  completed_at: srow.completed_at as string | Date | null,
                  time_spent_seconds: srow.time_spent_seconds || 0,
                  server_time_seconds: Number(srow.server_time_seconds) || 0,
                  last_heartbeat_at: srow.last_heartbeat_at ?? null,
                });
              },
            );
          }
        }
      }

      const metaById = new Map<number, VideoMetaRow>(
        expandedVideoRows.map((r) => [r.id, r]),
      );

      result.rows.forEach((row: Record<string, unknown>) => {
        row.question_count = questionCounts[row.id as number] || 0;
        if (teacher_code) {
          row.recent_submission = submissionsMap[row.id as number] || null;

          const vid = row.video_id as number | null | undefined;
          if (vid == null || vid <= 0) {
            row.video_completion_status = null;
            return;
          }

          const anchor = metaById.get(vid);
          if (!anchor) {
            row.video_completion_status = 'not_started';
            return;
          }

          const sameGroup = expandedVideoRows.filter((r) =>
            anchor.video_group_id
              ? r.video_group_id === anchor.video_group_id
              : r.id === anchor.id,
          );
          const sorted = [...sameGroup].sort((a, b) => {
            const left = a.chunk_index ?? 0;
            const right = b.chunk_index ?? 0;
            if (left !== right) return left - right;
            return a.id - b.id;
          });
          const sourceVideoIds = sorted.map((r) => r.id);
          const chunkMetasSorted = sorted.map((r) => ({
            id: r.id,
            duration_seconds: r.duration_seconds,
            duration_minutes: r.duration_minutes,
          }));

          const effective = effectiveCompletionForGroupedLesson({
            sourceVideoIds,
            chunkMetasSorted,
            scoresMap: scoresMapAll,
            quizEvidenceVideoIds,
          });
          row.video_completion_status = effective.completion_status;

          // Merge imported score with recent_submission
          const importedScores = sourceVideoIds
            .map((id) => scoresMapAll.get(id)?.score)
            .filter((s): s is number => s !== undefined && s !== null);
          const bestImportedScore = importedScores.length > 0 ? Math.max(...importedScores) : 0;

          let finalScore = bestImportedScore;
          if (row.recent_submission && (row.recent_submission as any).score !== null) {
            finalScore = Math.max(bestImportedScore, Number((row.recent_submission as any).score));
          }

          if (finalScore > 0 || row.recent_submission) {
            if (!row.recent_submission) {
              row.recent_submission = {
                score: finalScore,
                percentage: null,
                is_passed: true,
                submitted_at: effective.completed_at || null,
                attempt_number: 1,
                total_points: row.question_count // To display correctly on frontend
              };
            } else {
              (row.recent_submission as any).score = finalScore;
            }
          }
        } else {
          row.video_completion_status = null;
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error: any) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST: Táº¡o assignment má»›i
export async function POST(request: NextRequest) {
  try {
    const authGate = await requireBearerAdminOrSuperMutation(request);
    if (!authGate.ok) return authGate.response;

    const body = await request.json();
    const {
      video_id,
      assignment_title,
      assignment_type = 'quiz',
      description,
    } = body;

    if (!assignment_title) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: assignment_title' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO training_video_assignments
       (video_id, assignment_title, assignment_type, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [video_id ? parseInt(video_id, 10) : null, assignment_title, assignment_type, description || null]
    );

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Assignment created successfully'
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating assignment:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT: Cáº­p nháº­t assignment
export async function PUT(request: NextRequest) {
  try {
    const authGate = await requireBearerAdminOrSuperMutation(request);
    if (!authGate.ok) return authGate.response;

    const body = await request.json();
    const { id: initialId, ...updateData } = body;

    let id = initialId;

    if (!id) {
      const { searchParams } = new URL(request.url);
      id = searchParams.get('id');
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Assignment ID is required' },
        { status: 400 }
      );
    }

    // Loáº¡i bá» cÃ¡c field Ä‘Ã£ bá»‹ xÃ³a khá»i DB
    const REMOVED_FIELDS = ['status', 'total_points', 'passing_score', 'time_limit_minutes', 'max_attempts', 'is_required', 'due_date'];
    REMOVED_FIELDS.forEach(f => delete updateData[f]);

    const fields = Object.keys(updateData).filter(
      key => updateData[key] !== undefined && ASSIGNMENT_UPDATE_COLUMNS[key],
    );
    if (fields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Build SET clause vá»›i Ä‘Ãºng $N placeholder
    const setClause = fields.map((field, index) => `${ASSIGNMENT_UPDATE_COLUMNS[field]} = $${index + 2}`).join(', ');
    const values = [id, ...fields.map(field => updateData[field])];

    const result = await pool.query(
      `UPDATE training_video_assignments SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Assignment updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating assignment:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE: XÃ³a assignment
export async function DELETE(request: NextRequest) {
  try {
    const authGate = await requireBearerAdminOrSuperMutation(request);
    if (!authGate.ok) return authGate.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Assignment ID is required' },
        { status: 400 }
      );
    }

    // Kiá»ƒm tra video status trÆ°á»›c khi xÃ³a
    const checkResult = await pool.query(
      `SELECT a.id, v.status AS video_status
       FROM training_video_assignments a
       LEFT JOIN training_videos v ON v.id = a.video_id
       WHERE a.id = $1`,
      [id]
    );

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      );
    }

    if (checkResult.rows[0].video_status === 'active') {
      return NextResponse.json(
        { success: false, error: 'KhÃ´ng thá»ƒ xÃ³a assignment khi video Ä‘ang Active' },
        { status: 403 }
      );
    }

    // Láº¥y áº£nh cá»§a táº¥t cáº£ cÃ¢u há»i TRÆ¯á»šC khi xÃ³a (CASCADE sáº½ xÃ³a questions cÃ¹ng lÃºc vá»›i assignment)
    const questions = await pool.query(
      `SELECT image_url, question_text, correct_answer, explanation, options
         FROM training_assignment_questions
        WHERE assignment_id = $1`,
      [id]
    );

    const result = await pool.query(
      'DELETE FROM training_video_assignments WHERE id = $1 RETURNING *',
      [id]
    );

    // XÃ³a áº£nh S3 sau khi DB delete thÃ nh cÃ´ng
    questions.rows.forEach((q) => deleteQuestionImagesSilently([
      q.image_url,
      q.question_text,
      q.correct_answer,
      q.explanation,
      parseQuestionOptions(q.options),
    ]));

    return NextResponse.json({
      success: true,
      message: 'Assignment deleted successfully',
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error deleting assignment:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
