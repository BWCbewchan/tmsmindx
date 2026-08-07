import { rejectCandidateIdMismatch, requireCandidateSession } from '@/lib/candidate-session';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const candidateAuth = await requireCandidateSession(request);
  if (!candidateAuth.ok) return candidateAuth.response;

  const requestedCandidateId = request.nextUrl.searchParams.get('candidate_id');
  const mismatch = rejectCandidateIdMismatch(
    candidateAuth.candidateId,
    requestedCandidateId || candidateAuth.candidateId,
  );
  if (mismatch) return mismatch;

  const candidateId = candidateAuth.candidateId;

  try {
    const candidateResult = await pool.query(
      `SELECT c.id,
              COALESCE(c.current_gen_id, c.gen_id) AS current_gen_id,
              g.gen_name AS current_gen_name,
              c.region_code,
              c.region_name
       FROM hr_candidates c
       LEFT JOIN hr_gen_catalog g ON g.id = COALESCE(c.current_gen_id, c.gen_id)
       WHERE c.id = $1 AND c.is_deleted = false`,
      [candidateId],
    );

    if (candidateResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Khong tim thay ung vien.' },
        { status: 404 },
      );
    }

    const candidate = candidateResult.rows[0];

    if (!candidate.current_gen_id) {
      return NextResponse.json({
        success: true,
        data: {
          currentGen: null,
          sessions: [],
        },
      });
    }

    const sessionsResult = await pool.query(
      `SELECT s.id,
              s.gen_id,
              s.session_number,
              s.title,
              to_char(s.session_date, 'YYYY-MM-DD') AS session_date,
              to_char(s.start_time, 'HH24:MI') AS start_time,
              to_char(s.end_time, 'HH24:MI') AS end_time,
              s.center_id,
              COALESCE(c.display_name, c.full_name) AS center_name,
              COALESCE(c.map_url, c.map_link) AS center_map_url,
              COALESCE(c.full_address, c.address) AS center_address,
              s.location,
              s.mentor_code,
              s.mentor_name,
              s.mentor_email,
              s.training_mode,
              s.status
       FROM hr_training_sessions s
       LEFT JOIN centers c ON c.id = s.center_id
       WHERE s.gen_id = $1
       ORDER BY s.session_date ASC NULLS LAST, s.session_number ASC`,
      [candidate.current_gen_id],
    );

    return NextResponse.json({
      success: true,
      data: {
        currentGen: {
          id: candidate.current_gen_id,
          genCode: candidate.current_gen_name || String(candidate.current_gen_id),
          regionCode: candidate.region_code || '',
          regionName: candidate.region_name || '',
        },
        sessions: sessionsResult.rows.map((row: any) => ({
          gen: candidate.current_gen_name || String(candidate.current_gen_id),
          region: candidate.region_name || candidate.region_code || '',
          session: Number(row.session_number),
          date: row.session_date,
          startTime: row.start_time || '',
          endTime: row.end_time || '',
          time: row.start_time && row.end_time ? `${row.start_time} - ${row.end_time}` : '',
          centerId: row.center_id,
          centerName: row.center_name || '',
          centerMapUrl: row.center_map_url || null,
          centerAddress: row.center_address || null,
          location: row.location || row.center_name || '',
          mentorCode: row.mentor_code || null,
          mentorName: row.mentor_name || null,
          mentorEmail: row.mentor_email || null,
          trainingMode: row.training_mode || 'offline',
          status: row.status || 'draft',
          title: row.title,
        })),
      },
    });
  } catch (error) {
    console.error('[Candidate Portal Training Sessions] error:', error);
    return NextResponse.json(
      { success: false, error: 'Khong the tai lich training.' },
      { status: 500 },
    );
  }
}

