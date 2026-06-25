/**
 * event-schedule-participants/route.ts
 *
 * GET /api/event-schedule-participants?event_id=<uuid>&status=accepted
 *
 * Trả về danh sách giáo viên đã đăng ký kiểm tra cho một event cụ thể.
 * Dữ liệu lấy từ chuyen_sau_results WHERE id_su_kien = event_id,
 * JOIN với chuyen_sau_monhoc để lấy tên môn.
 */

import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    const status = searchParams.get('status'); // 'accepted' hoặc bỏ qua

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu event_id' },
        { status: 400 },
      );
    }

    // Query danh sách giáo viên đăng ký kiểm tra cho event này
    const result = await pool.query(
      `SELECT
         r.id                                          AS id,
         r.ma_giao_vien                                AS teacher_code,
         r.ho_ten                                      AS teacher_name,
         r.dia_chi_email                               AS teacher_email,
         r.co_so_lam_viec                              AS teacher_center,
         r.khu_vuc                                     AS area,
         r.hinh_thuc                                   AS registration_type,
         COALESCE(mh.ten_mon, mh.ma_mon, '')           AS subject_name,
         COALESCE(mh.loai_ky_thi, 'expertise')         AS exam_type,
         mh.ma_khoi                                    AS block_code,
         r.thang_dk                                    AS month,
         r.nam_dk                                      AS year,
         r.dot                                         AS batch,
         r.diem                                        AS score,
         r.xu_ly_diem                                  AS score_status,
         r.tao_luc                                     AS registered_at,
         -- Trạng thái tham gia
         CASE
           WHEN r.diem IS NOT NULL
             OR LOWER(TRIM(COALESCE(r.xu_ly_diem, ''))) IN ('đã hoàn thành', 'da thi')
           THEN 'completed'
           ELSE 'registered'
         END AS status
       FROM chuyen_sau_results r
       LEFT JOIN chuyen_sau_monhoc mh ON mh.id = r.id_mon
       WHERE r.id_su_kien = $1
       ORDER BY r.ho_ten ASC, r.tao_luc ASC`,
      [eventId],
    );

    const participants = result.rows.map((row) => ({
      id: row.id,
      teacher_code: String(row.teacher_code ?? ''),
      teacher_name: String(row.teacher_name ?? ''),
      teacher_email: String(row.teacher_email ?? ''),
      teacher_center: String(row.teacher_center ?? ''),
      area: String(row.area ?? ''),
      registration_type: String(row.registration_type ?? ''),
      subject_name: String(row.subject_name ?? ''),
      exam_type: String(row.exam_type ?? 'expertise'),
      block_code: String(row.block_code ?? ''),
      month: row.month,
      year: row.year,
      batch: row.batch,
      score: row.score !== null ? Number(row.score) : null,
      score_status: String(row.score_status ?? ''),
      registered_at: row.registered_at,
      status: String(row.status ?? 'registered'),
    }));

    return NextResponse.json({
      success: true,
      data: participants,
      count: participants.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi server';
    console.error('[event-schedule-participants] GET error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
