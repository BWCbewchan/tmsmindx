import {
  rejectCandidateIdMismatch,
  requireCandidateSession,
} from '@/lib/candidate-session';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const candidateAuth = await requireCandidateSession(request);
    if (!candidateAuth.ok) return candidateAuth.response;

    const { candidate_id, center_code, observe_date, class_type, harvest_file_url } = await request.json();
    const mismatch = rejectCandidateIdMismatch(candidateAuth.candidateId, candidate_id);
    if (mismatch) return mismatch;

    if (!center_code || !observe_date || !class_type || !harvest_file_url) {
      return NextResponse.json({ success: false, error: 'Thieu thong tin bat buoc' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO hr_observe_sessions (candidate_id, center_code, observe_date, class_type, harvest_file_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [candidateAuth.candidateId, center_code, observe_date, class_type, harvest_file_url],
    );

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Candidate Portal Observe POST]', error);
    return NextResponse.json({ success: false, error: 'Loi khi nop bai thu hoach' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const candidateAuth = await requireCandidateSession(request);
    if (!candidateAuth.ok) return candidateAuth.response;

    const requestedCandidateId = request.nextUrl.searchParams.get('candidate_id');
    const mismatch = rejectCandidateIdMismatch(candidateAuth.candidateId, requestedCandidateId || candidateAuth.candidateId);
    if (mismatch) return mismatch;

    const result = await pool.query(
      `SELECT * FROM hr_observe_sessions WHERE candidate_id = $1 ORDER BY observe_date DESC`,
      [candidateAuth.candidateId],
    );

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Candidate Portal Observe GET]', error);
    return NextResponse.json({ success: false, error: 'Loi khi lay danh sach bai thu hoach' }, { status: 500 });
  }
}

