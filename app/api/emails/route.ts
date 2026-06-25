import { NextResponse } from 'next/server';
import {
  sendLeaveAdminRejectedEmail,
  sendLeaveSubstituteConfirmedEmail,
  type LeaveAdminRejectedData,
  type LeaveApprovedSubstituteConfirmedData,
} from '@/lib/leave-request-emails';
import type { NextRequest } from 'next/server';

function requireInternalEmailSecret(request: NextRequest): NextResponse | null {
  const configuredSecret = process.env.INTERNAL_API_SECRET || process.env.EMAIL_INTERNAL_API_SECRET || '';
  if (!configuredSecret) {
    return NextResponse.json(
      { success: false, error: 'INTERNAL_API_SECRET is not configured' },
      { status: 500 },
    );
  }
  const providedSecret = request.headers.get('x-internal-api-secret') || '';
  if (providedSecret !== configuredSecret) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized email request' },
      { status: 401 },
    );
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const denied = requireInternalEmailSecret(request);
    if (denied) return denied;

    const body = await request.json();
    const { type, data } = body as {
      type?: string;
      data?: LeaveApprovedSubstituteConfirmedData | LeaveAdminRejectedData;
    };

    if (type === 'leave_approved_substitute_confirmed') {
      const result = await sendLeaveSubstituteConfirmedEmail(
        data as LeaveApprovedSubstituteConfirmedData,
        { via: 'app/api/emails' },
      );
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 },
        );
      }
      return NextResponse.json({
        success: true,
        sent: result.sent,
        warning: result.warning,
        recipients: result.recipients,
      });
    }

    if (type === 'leave_admin_rejected') {
      const result = await sendLeaveAdminRejectedEmail(
        data as LeaveAdminRejectedData,
        { via: 'app/api/emails' },
      );
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 },
        );
      }
      return NextResponse.json({
        success: true,
        sent: result.sent,
        warning: result.warning,
        recipients: result.recipients,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported email type' },
      { status: 400 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[emails/route] error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
