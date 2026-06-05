import { NextRequest, NextResponse } from 'next/server';
import { withApiProtection } from '@/lib/api-protection';
import { requireBearerAdminOrSuperMutation } from '@/lib/auth-server';
import { requireBearerSession } from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { sanitizeHtml } from '@/lib/server-sanitize-html';

// GET: Fetch questions for a video (no authentication required for admin)
export const GET = async (request: NextRequest) => {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const searchParams = request.nextUrl.searchParams;
    const videoId = searchParams.get('video_id');

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    const canReadAnswers = ['super_admin', 'admin'].includes(auth.resolvedAccess.role);
    const query = `
      SELECT 
        id,
        video_id,
        question_text,
        question_type,
        time_in_video,
        ${canReadAnswers ? 'correct_answer,' : ''}
        options,
        points,
        order_number
      FROM training_video_questions
      WHERE video_id = $1
      ORDER BY time_in_video ASC
    `;

    const result = await pool.query(query, [videoId]);

    return NextResponse.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('[Training Video Questions API] Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to fetch video questions'
      },
      { status: 500 }
    );
  }
};

// POST: Add a new question
export const POST = withApiProtection(async (request: NextRequest) => {
  try {
    const authGate = await requireBearerAdminOrSuperMutation(request);
    if (!authGate.ok) return authGate.response;

    const body = await request.json();
    const { 
      video_id, 
      question_text, 
      time_in_video, 
      correct_answer, 
      options,
      question_type = 'multiple_choice',
      points = 1.00,
      order_number
    } = body;

    if (!video_id || !question_text || time_in_video === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: video_id, question_text, time_in_video' },
        { status: 400 }
      );
    }

    const videoStatusQuery = 'SELECT status FROM training_videos WHERE id = $1';
    const videoStatusResult = await pool.query(videoStatusQuery, [video_id]);

    if (videoStatusResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    if (videoStatusResult.rows[0].status === 'active') {
      return NextResponse.json(
        { error: 'Cannot modify interactive questions while video is active' },
        { status: 403 }
      );
    }

    const query = `
      INSERT INTO training_video_questions 
      (video_id, question_text, question_type, time_in_video, correct_answer, options, points, order_number)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await pool.query(query, [
      video_id,
      sanitizeHtml(String(question_text)),
      question_type,
      time_in_video,
      correct_answer == null ? null : sanitizeHtml(String(correct_answer)),
      JSON.stringify(
        Array.isArray(options)
          ? options.map((option) => sanitizeHtml(String(option)))
          : options,
      ),
      points,
      order_number
    ]);

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[Training Video Questions API] Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to add video question'
      },
      { status: 500 }
    );
  }
});

// DELETE: Remove a question
export const DELETE = withApiProtection(async (request: NextRequest) => {
  try {
    const authGate = await requireBearerAdminOrSuperMutation(request);
    if (!authGate.ok) return authGate.response;

    const searchParams = request.nextUrl.searchParams;
    const questionId = searchParams.get('id');

    if (!questionId) {
      return NextResponse.json({ error: 'Question ID is required' }, { status: 400 });
    }

    const questionVideoQuery = `
      SELECT tv.status
      FROM training_video_questions tvq
      JOIN training_videos tv ON tv.id = tvq.video_id
      WHERE tvq.id = $1
    `;
    const questionVideoResult = await pool.query(questionVideoQuery, [questionId]);

    if (questionVideoResult.rows.length === 0) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    if (questionVideoResult.rows[0].status === 'active') {
      return NextResponse.json(
        { error: 'Cannot delete interactive question while video is active' },
        { status: 403 }
      );
    }

    const query = `DELETE FROM training_video_questions WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [questionId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    console.error('[Training Video Questions API] Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to delete video question'
      },
      { status: 500 }
    );
  }
});
