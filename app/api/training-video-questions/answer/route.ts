import { requireSameOriginMutation } from '@/lib/api-security';
import {
  rejectIfDatasourceLookupForbidden,
  requireBearerSession,
} from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

function parseAnswerIndex(value: unknown): number | null {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function POST(request: NextRequest) {
  const originDenied = requireSameOriginMutation(request);
  if (originDenied) return originDenied;

  const auth = await requireBearerSession(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const questionId = body.question_id;
    const selectedAnswer = parseAnswerIndex(body.selected_answer);
    const teacherCode = String(body.teacher_code || '').trim();

    if (!questionId || selectedAnswer === null) {
      return NextResponse.json(
        { success: false, error: 'question_id và selected_answer là bắt buộc' },
        { status: 400 },
      );
    }

    if (!auth.privileged && teacherCode) {
      const denied = await rejectIfDatasourceLookupForbidden(
        auth.sessionEmail,
        false,
        '',
        teacherCode,
      );
      if (denied) return denied;
    }

    const result = await pool.query(
      `SELECT id, correct_answer
       FROM training_video_questions
       WHERE id = $1
       LIMIT 1`,
      [questionId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy câu hỏi' },
        { status: 404 },
      );
    }

    const correctAnswer = parseAnswerIndex(result.rows[0].correct_answer);
    if (correctAnswer === null) {
      return NextResponse.json(
        { success: false, error: 'Câu hỏi chưa có đáp án hợp lệ' },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      correct: selectedAnswer === correctAnswer,
      correct_answer: correctAnswer,
    });
  } catch (error) {
    console.error('[Training Video Answer API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể kiểm tra đáp án' },
      { status: 500 },
    );
  }
}
