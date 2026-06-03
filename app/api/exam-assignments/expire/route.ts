import { withApiProtection } from '@/lib/api-protection';
import { requireBearerAdminOrSuperMutation } from '@/lib/auth-server';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const POST = withApiProtection(async (request: NextRequest) => {
  try {
    const authGate = await requireBearerAdminOrSuperMutation(request);
    if (!authGate.ok) return authGate.response;

    const result = await pool.query('SELECT expire_overdue_exam_assignments() AS affected_count');
    const affectedCount = Number(result.rows[0]?.affected_count || 0);

    return NextResponse.json({
      success: true,
      affectedCount,
      message: `Expired ${affectedCount} overdue assignments`,
    });
  } catch (error: any) {
    console.error('Error expiring overdue exam assignments:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to expire assignments' },
      { status: 500 }
    );
  }
});
