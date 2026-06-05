/**
 * exam-assignment-questions/route.ts
 *
 * Flow má»›i:
 *   - CÃ¢u há»i Ä‘Æ°á»£c phÃ¢n cÃ´ng dá»±a trÃªn chuyen_sau_results (result_id) chá»© khÃ´ng pháº£i báº£ng phÃ¢n cÃ´ng cÅ©.
 *   - GET  â†’ láº¥y cÃ¢u há»i Ä‘Æ°á»£c phÃ¢n cho result_id (tá»« bá»™ Ä‘á» Ä‘Ã£ gÃ¡n: ma_de trong chuyen_sau_results)
 *   - POST â†’ phÃ¢n cÃ´ng bá»™ Ä‘á» cho result â†’ cáº­p nháº­t ma_de + táº¡o cÃ¢u há»i trong chuyen_sau_baithi_cauhoi
 *   - PUT  â†’ cáº­p nháº­t thÃ´ng tin phÃ¢n cÃ´ng (ma_de)
 */

import pool from '@/lib/db';
import { requireBearerAdminOrSuperMutation } from '@/lib/auth-server';
import {
  rejectIfChuyenSauResultNotOwned,
  requireBearerSession,
} from '@/lib/datasource-api-auth';
import { NextRequest, NextResponse } from 'next/server';

// â”€â”€â”€ GET: Láº¥y cÃ¢u há»i theo result_id / assignment_id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    // Cháº¥p nháº­n cáº£ result_id vÃ  assignment_id (cÃ¹ng lÃ  chuyen_sau_results.id)
    const resultId = searchParams.get('result_id') || searchParams.get('assignment_id');

    if (!resultId) {
      return NextResponse.json(
        { success: false, error: 'Cáº§n result_id hoáº·c assignment_id' },
        { status: 400 }
      );
    }

    // TÃ¬m result kÃ¨m thÃ´ng tin bá»™ Ä‘á» (fallback tá»« chonde_thang náº¿u id_de_thi chÆ°a set)
    const denied = await rejectIfChuyenSauResultNotOwned(
      auth.sessionEmail,
      Boolean(auth.resolvedAccess.isAdmin),
      resultId,
    );
    if (denied) return denied;

    const resultRow = await pool.query(
      `SELECT
         r.id,
         r.id_de_thi,
         COALESCE(r.id_de_thi, ct_sub.id_de)         AS resolved_set_id,
         r.id_mon,
         r.id_su_kien,
         r.ma_giao_vien,
         r.ho_ten,
         r.diem,
         r.thang_dk,
         r.nam_dk,
         r.dang_ky_luc,
         r.thoi_gian_kiem_tra,
         mh.ma_mon,
         mh.ten_mon,
         mh.ma_khoi,
         mh.loai_ky_thi,
         mh.thoi_gian_thi_phut,
         -- Thá»i gian lÃ m bÃ i thá»±c táº¿ tá»« event_schedules (ket_thuc - bat_dau), fallback tá»« mÃ´n há»c
         COALESCE(ev_dur.duration_min, mh.thoi_gian_thi_phut, 90)::int AS event_duration_minutes,
         ev_dur.event_open_at,
         ev_dur.event_close_at,
         bd.id                                        AS bode_id,
         bd.ma_de                                     AS set_code,
         bd.ten_de                                    AS set_name,
         bd.tong_diem                                 AS total_points,
         bd.diem_dat                                  AS passing_score
       FROM chuyen_sau_results r
       JOIN chuyen_sau_monhoc mh ON mh.id = r.id_mon
       LEFT JOIN LATERAL (
         SELECT ct.id_de FROM chuyen_sau_chonde_thang ct
         WHERE ct.id_mon = r.id_mon
           AND ct.nam   = COALESCE(r.nam_dk,   EXTRACT(YEAR  FROM NOW())::int)
           AND ct.thang = COALESCE(r.thang_dk, EXTRACT(MONTH FROM NOW())::int)
         LIMIT 1
       ) ct_sub ON (r.id_de_thi IS NULL)
       LEFT JOIN chuyen_sau_bode bd ON bd.id = COALESCE(r.id_de_thi, ct_sub.id_de)
       -- Láº¥y thá»i gian lÃ m bÃ i tá»« event_schedules:
       -- Æ¯u tiÃªn 1: id_su_kien trá» Ä‘áº¿n sá»± kiá»‡n 'exam' â†’ dÃ¹ng bat_dau_luc/ket_thuc_luc cá»§a exam
       -- Æ¯u tiÃªn 2: id_su_kien trá» Ä‘áº¿n sá»± kiá»‡n 'registration' (bá»• sung) â†’ close_at = ket_thuc_luc cá»§a registration
       -- Æ¯u tiÃªn 3: fallback tÃ¬m exam theo thÃ¡ng/nÄƒm/mÃ´n
       LEFT JOIN LATERAL (
         SELECT
           CASE
             WHEN es.loai_su_kien = 'exam'
               THEN (EXTRACT(EPOCH FROM (es.ket_thuc_luc - es.bat_dau_luc)) / 60)::int
             ELSE COALESCE(mh.thoi_gian_thi_phut, 90)
           END AS duration_min,
           CASE
             WHEN es.loai_su_kien = 'exam'
               THEN es.bat_dau_luc AT TIME ZONE 'Asia/Ho_Chi_Minh'
             ELSE NULL
           END AS event_open_at,
           -- close_at: vá»›i registration (bá»• sung) â†’ Ä‘Ã³ng theo ket_thuc_luc cá»§a sá»± kiá»‡n Ä‘Äƒng kÃ½
           es.ket_thuc_luc AT TIME ZONE 'Asia/Ho_Chi_Minh' AS event_close_at
         FROM event_schedules es
         WHERE (
             (r.id_su_kien IS NOT NULL AND es.id = r.id_su_kien)
             OR (
               r.id_su_kien IS NULL
               AND es.loai_su_kien = 'exam'
               AND es.chuyen_nganh = mh.ma_mon
               AND EXTRACT(YEAR  FROM es.bat_dau_luc) = COALESCE(r.nam_dk,  EXTRACT(YEAR  FROM NOW()))
               AND EXTRACT(MONTH FROM es.bat_dau_luc) = COALESCE(r.thang_dk, EXTRACT(MONTH FROM NOW()))
             )
           )
         ORDER BY
           (r.id_su_kien IS NOT NULL AND es.id = r.id_su_kien) DESC,
           es.bat_dau_luc DESC
         LIMIT 1
       ) ev_dur ON TRUE
       WHERE r.id = $1
       LIMIT 1`,
      [resultId]
    );

    if (resultRow.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'KhÃ´ng tÃ¬m tháº¥y káº¿t quáº£ Ä‘Äƒng kÃ½' }, { status: 404 });
    }

    const row = resultRow.rows[0];
    const resolvedSetId = row.resolved_set_id;

    if (!resolvedSetId) {
      return NextResponse.json({
        success: false,
        error: 'ChÆ°a cÃ³ bá»™ Ä‘á» nÃ o Ä‘Æ°á»£c phÃ¢n cÃ´ng cho láº§n thi nÃ y',
      }, { status: 404 });
    }

    // TÃ­nh open_at / close_at:
    // - Äá»£t CHÃNH THá»¨C (loai_su_kien='exam'): event_open_at VÃ€ event_close_at Ä‘á»u cÃ³ â†’ dÃ¹ng cáº£ hai
    // - Äá»£t Bá»” SUNG (loai_su_kien='registration'): chá»‰ cÃ³ event_close_at (deadline Ä‘Ã³ng bÃ i)
    //   â†’ open_at tÃ­nh tá»« thoi_gian_kiem_tra hoáº·c fallback, close_at = ket_thuc_luc sá»± kiá»‡n Ä‘Äƒng kÃ½
    // - Fallback: khÃ´ng cÃ³ event â†’ dÃ¹ng thoi_gian_kiem_tra hoáº·c thÃ¡ng/nÄƒm
    const timeLimitMinutes = Number(row.event_duration_minutes) || 90;
    const durationMs = timeLimitMinutes * 60_000;

    let openAtTs: string;
    let closeAtTs: string;

    if (row.event_open_at && row.event_close_at) {
      // Äá»£t CHÃNH THá»¨C: cÃ³ cáº£ open vÃ  close tá»« sá»± kiá»‡n exam
      openAtTs  = new Date(row.event_open_at).toISOString();
      closeAtTs = new Date(row.event_close_at).toISOString();
    } else if (!row.event_open_at && row.event_close_at) {
      // Äá»£t Bá»” SUNG: chá»‰ cÃ³ close_at tá»« sá»± kiá»‡n registration
      // open_at = dang_ky_luc (thá»i Ä‘iá»ƒm táº¡o assignment), khÃ´ng dÃ¹ng thoi_gian_kiem_tra
      openAtTs = row.dang_ky_luc
        ? new Date(row.dang_ky_luc).toISOString()
        : new Date().toISOString();
      closeAtTs = new Date(row.event_close_at).toISOString();
    } else {
      // Äá»£t Bá»” SUNG hoáº·c khÃ´ng cÃ³ sá»± kiá»‡n: tÃ­nh open_at tá»« thoi_gian_kiem_tra / fallback
      const THOI_GIAN_REGEX = /^[0-9]{1,2}:[0-9]{2} [0-9]{2}\/[0-9]{2}\/[0-9]{4}$/;
      const hasStartedTime =
        typeof row.thoi_gian_kiem_tra === 'string' &&
        THOI_GIAN_REGEX.test(row.thoi_gian_kiem_tra.trim());

      if (hasStartedTime) {
        const [timePart, datePart] = row.thoi_gian_kiem_tra.trim().split(' ');
        const [hh, mm] = timePart.split(':').map(Number);
        const [dd, mo, yyyy] = datePart.split('/').map(Number);
        const startMs = Date.UTC(yyyy, mo - 1, dd, hh - 7, mm, 0, 0);
        openAtTs = new Date(startMs).toISOString();
        // close_at: náº¿u cÃ³ event_close_at (bá»• sung) â†’ dÃ¹ng deadline sá»± kiá»‡n, khÃ´ng dÃ¹ng startMs + duration
        closeAtTs = row.event_close_at
          ? new Date(row.event_close_at).toISOString()
          : new Date(startMs + durationMs).toISOString();
      } else if (row.thang_dk && row.nam_dk) {
        openAtTs  = new Date(row.nam_dk, row.thang_dk - 1, 1).toISOString();
        // close_at: náº¿u cÃ³ event_close_at (bá»• sung) â†’ dÃ¹ng deadline sá»± kiá»‡n
        closeAtTs = row.event_close_at
          ? new Date(row.event_close_at).toISOString()
          : new Date(row.nam_dk, row.thang_dk, 1).toISOString();
      } else if (row.dang_ky_luc) {
        openAtTs  = new Date(row.dang_ky_luc).toISOString();
        closeAtTs = row.event_close_at
          ? new Date(row.event_close_at).toISOString()
          : new Date(new Date(row.dang_ky_luc).getTime() + durationMs).toISOString();
      } else {
        openAtTs  = new Date().toISOString();
        closeAtTs = row.event_close_at
          ? new Date(row.event_close_at).toISOString()
          : new Date(Date.now() + durationMs).toISOString();
      }
    }

    // Build assignment object Ä‘Ãºng format mÃ  exam page cáº§n
    const assignment = {
      id: row.id,
      teacher_code: row.ma_giao_vien || '',
      subject_code: row.ma_mon || '',
      subject_name: row.ten_mon || '',
      set_code: row.set_code || '',
      set_name: row.set_name || '',
      open_at: openAtTs,
      close_at: closeAtTs,
      total_points: Number(row.total_points || 0),
      passing_score: row.passing_score != null ? Number(row.passing_score) : null,
      assignment_status: 'assigned',
      score: row.diem != null ? Number(row.diem) : null,
      time_limit_minutes: timeLimitMinutes,
    };

    // Láº¥y cÃ¢u há»i tá»« bá»™ Ä‘á»
    const canReadAnswers = ['super_admin', 'admin'].includes(auth.resolvedAccess.role);
    const questions = await pool.query(
      `SELECT
         cq.id                                              AS id,
         bc.id_de                                          AS set_id,
         bd.ma_de                                          AS set_code,
         cq.loai_cau_hoi                                   AS question_type,
         cq.noi_dung_cau_hoi                               AS question_text,
         CASE
           WHEN cq.lua_chon_a IS NOT NULL OR cq.lua_chon_b IS NOT NULL
            OR cq.lua_chon_c IS NOT NULL OR cq.lua_chon_d IS NOT NULL
           THEN jsonb_build_array(cq.lua_chon_a, cq.lua_chon_b, cq.lua_chon_c, cq.lua_chon_d)
           ELSE NULL
         END                                               AS options,
         ${canReadAnswers ? 'cq.dap_an_dung' : 'NULL::text'} AS correct_answer,
         ${canReadAnswers ? 'cq.giai_thich' : 'NULL::text'} AS explanation,
         cq.image_url                                      AS image_url,
         cq.diem                                           AS points,
         cq.do_kho                                         AS difficulty,
         bc.thu_tu_hien_thi                                AS order_number
       FROM chuyen_sau_bode bd
       JOIN chuyen_sau_bode_cauhoi bc ON bc.id_de = bd.id
       JOIN chuyen_sau_cauhoi cq      ON cq.id = bc.id_cau
       WHERE bd.id = $1
       ORDER BY bc.thu_tu_hien_thi ASC`,
      [resolvedSetId]
    );

    return NextResponse.json({
      success: true,
      assignment,
      questions: questions.rows,
      count: questions.rows.length,
    });
  } catch (error) {
    console.error('Error fetching assignment questions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch assignment questions' }, { status: 500 });
  }
}

// â”€â”€â”€ POST: PhÃ¢n cÃ´ng bá»™ Ä‘á» cho result â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const authGate = await requireBearerAdminOrSuperMutation(request);
    if (!authGate.ok) return authGate.response;

    const body = await request.json();
    const { result_id, set_code, set_id } = body;

    if (!result_id) {
      return NextResponse.json({ success: false, error: 'result_id is required' }, { status: 400 });
    }
    if (!set_code && !set_id) {
      return NextResponse.json({ success: false, error: 'set_code hoáº·c set_id lÃ  báº¯t buá»™c' }, { status: 400 });
    }

    await client.query('BEGIN');

    // XÃ¡c Ä‘á»‹nh bá»™ Ä‘á»
    let resolvedSetCode = set_code;
    if (!resolvedSetCode) {
      const setRow = await client.query('SELECT ma_de FROM chuyen_sau_bode WHERE id = $1', [set_id]);
      if (setRow.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: false, error: 'Bá»™ Ä‘á» khÃ´ng tá»“n táº¡i' }, { status: 404 });
      }
      resolvedSetCode = setRow.rows[0].ma_de;
    }

    // Cáº­p nháº­t ma_de vÃ  tráº¡ng thÃ¡i trÃªn results
    const updated = await client.query(
      `UPDATE chuyen_sau_results
       SET ma_de = $1, trang_thai = 'da_phan_cong'
       WHERE id = $2
       RETURNING *`,
      [resolvedSetCode, result_id]
    );

    if (updated.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'KhÃ´ng tÃ¬m tháº¥y result' }, { status: 404 });
    }

    await client.query('COMMIT');
    return NextResponse.json({
      success: true,
      data: updated.rows[0],
      message: `ÄÃ£ phÃ¢n cÃ´ng bá»™ Ä‘á» ${resolvedSetCode}`,
    }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error assigning questions:', error);
    return NextResponse.json({ success: false, error: 'Failed to assign questions' }, { status: 500 });
  } finally {
    client.release();
  }
}

// â”€â”€â”€ PUT: Äá»•i bá»™ Ä‘á» cho result â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function PUT(request: NextRequest) {
  try {
    const authGate = await requireBearerAdminOrSuperMutation(request);
    if (!authGate.ok) return authGate.response;

    const body = await request.json();
    const { result_id, set_code } = body;

    if (!result_id || !set_code) {
      return NextResponse.json({ success: false, error: 'result_id vÃ  set_code lÃ  báº¯t buá»™c' }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE chuyen_sau_results SET ma_de = $1 WHERE id = $2 AND trang_thai IN ('da_dang_ky', 'da_phan_cong')
       RETURNING *`,
      [set_code, result_id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'KhÃ´ng thá»ƒ Ä‘á»•i bá»™ Ä‘á» - káº¿t quáº£ khÃ´ng tá»“n táº¡i hoáº·c Ä‘Ã£ thi xong.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating assignment:', error);
    return NextResponse.json({ success: false, error: 'Failed to update assignment' }, { status: 500 });
  }
}
