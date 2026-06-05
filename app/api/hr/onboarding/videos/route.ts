import { requireBearerAdminOrSuperMutation } from '@/lib/auth-server';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API quáº£n lÃ½ Video ÄÃ o táº¡o Ä‘áº§u vÃ o (Onboarding Videos)
 * TÃ¡ch biá»‡t vá»›i thÆ° viá»‡n video chuyÃªn mÃ´n thÃ´ng qua video_category = 'onboarding'
 */

// GET: Láº¥y danh sÃ¡ch video Ä‘Ã o táº¡o Ä‘áº§u vÃ o
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const params: any[] = [];
    let whereClause = "WHERE tv.video_category = 'onboarding'";

    if (id) {
      params.push(id);
      whereClause += ` AND tv.id = $${params.length}`;
    }

    const query = `
      SELECT
        tv.*,
        COALESCE(SUM(tvs.view_count), 0)::INTEGER AS view_count,
        COUNT(DISTINCT tvs.teacher_code) FILTER (WHERE COALESCE(tvs.view_count, 0) > 0)::INTEGER AS viewers
      FROM training_videos tv
      LEFT JOIN training_teacher_video_scores tvs ON tv.id = tvs.video_id
      ${whereClause}
      GROUP BY tv.id
      ORDER BY tv.lesson_number ASC NULLS LAST, tv.created_at DESC
    `;

    const result = await pool.query(query, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Onboarding Videos GET]', error);
    return NextResponse.json({ success: false, error: 'Lá»—i khi táº£i danh sÃ¡ch video Ä‘Ã o táº¡o' }, { status: 500 });
  }
}

// POST: ThÃªm video Ä‘Ã o táº¡o Ä‘áº§u vÃ o
export async function POST(request: NextRequest) {
  try {
    const authGate = await requireBearerAdminOrSuperMutation(request);
    if (!authGate.ok) return authGate.response;

    const body = await request.json();
    const {
      title,
      description,
      video_link,
      thumbnail_url,
      lesson_number,
      duration_minutes,
      duration_seconds,
      start_date,
      status = 'draft',
      video_group_id,
      chunk_index,
      chunk_total,
      original_filename,
      original_size_bytes,
    } = body;

    if (!title || !video_link) {
      return NextResponse.json({ success: false, error: 'TiÃªu Ä‘á» vÃ  Ä‘Æ°á»ng dáº«n video lÃ  báº¯t buá»™c' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO training_videos 
        (
          title,
          description,
          video_link,
          thumbnail_url,
          lesson_number,
          duration_minutes,
          duration_seconds,
          start_date,
          status,
          video_category,
          video_group_id,
          chunk_index,
          chunk_total,
          original_filename,
          original_size_bytes
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'onboarding', $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        title,
        description || null,
        video_link,
        thumbnail_url || null,
        lesson_number || null,
        duration_minutes || 30,
        duration_seconds || null,
        start_date || new Date().toISOString().split('T')[0],
        status,
        video_group_id || null,
        chunk_index || null,
        chunk_total || null,
        original_filename || null,
        original_size_bytes || null,
      ]
    );

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Onboarding Videos POST]', error);
    return NextResponse.json({ success: false, error: 'Lá»—i khi thÃªm video Ä‘Ã o táº¡o' }, { status: 500 });
  }
}

// PATCH: Cáº­p nháº­t video Ä‘Ã o táº¡o Ä‘áº§u vÃ o
export async function PATCH(request: NextRequest) {
  try {
    const authGate = await requireBearerAdminOrSuperMutation(request);
    if (!authGate.ok) return authGate.response;

    const body = await request.json();
    const {
      id,
      title,
      description,
      video_link,
      thumbnail_url,
      lesson_number,
      duration_minutes,
      duration_seconds,
      start_date,
      status,
      original_filename,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID video lÃ  báº¯t buá»™c' }, { status: 400 });
    }

    // Verify it's an onboarding video
    const checkResult = await pool.query(
      "SELECT id FROM training_videos WHERE id = $1 AND video_category = 'onboarding'",
      [id]
    );
    if (checkResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'KhÃ´ng tÃ¬m tháº¥y video Ä‘Ã o táº¡o' }, { status: 404 });
    }

    const result = await pool.query(
      `UPDATE training_videos SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        video_link = COALESCE($3, video_link),
        thumbnail_url = COALESCE($4, thumbnail_url),
        lesson_number = COALESCE($5, lesson_number),
        duration_minutes = COALESCE($6, duration_minutes),
        start_date = COALESCE($7, start_date),
        status = COALESCE($8, status),
        duration_seconds = COALESCE($9, duration_seconds),
        original_filename = COALESCE($10, original_filename)
       WHERE id = $11 AND video_category = 'onboarding'
       RETURNING *`,
      [
        title,
        description,
        video_link,
        thumbnail_url,
        lesson_number,
        duration_minutes,
        start_date,
        status,
        duration_seconds,
        original_filename,
        id,
      ]
    );

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Onboarding Videos PATCH]', error);
    return NextResponse.json({ success: false, error: 'Lá»—i khi cáº­p nháº­t video Ä‘Ã o táº¡o' }, { status: 500 });
  }
}

// DELETE: XÃ³a video Ä‘Ã o táº¡o Ä‘áº§u vÃ o
export async function DELETE(request: NextRequest) {
  try {
    const authGate = await requireBearerAdminOrSuperMutation(request);
    if (!authGate.ok) return authGate.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID video lÃ  báº¯t buá»™c' }, { status: 400 });
    }

    // Verify it's an onboarding video before delete
    const checkResult = await pool.query(
      "SELECT id FROM training_videos WHERE id = $1 AND video_category = 'onboarding'",
      [id]
    );
    if (checkResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'KhÃ´ng tÃ¬m tháº¥y video Ä‘Ã o táº¡o' }, { status: 404 });
    }

    await pool.query('DELETE FROM training_videos WHERE id = $1', [id]);
    return NextResponse.json({ success: true, message: 'ÄÃ£ xÃ³a video Ä‘Ã o táº¡o' });
  } catch (error) {
    console.error('[Onboarding Videos DELETE]', error);
    return NextResponse.json({ success: false, error: 'Lá»—i khi xÃ³a video Ä‘Ã o táº¡o' }, { status: 500 });
  }
}
