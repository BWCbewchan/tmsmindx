import { requireBearerAdminOrSuperMutation } from '@/lib/auth-server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * API cÅ©: mail giáº£i trÃ¬nh khÃ´ng tham gia kiá»ƒm tra chuyÃªn sÃ¢u (new / accepted / rejected).
 * ÄÃ£ táº¯t toÃ n bá»™ â€” khÃ´ng gá»­i SMTP.
 *
 * Luá»“ng mail cÃ²n dÃ¹ng: xin nghá»‰ 1 buá»•i â†’ `POST /api/emails` (gá»i tá»« `leave-requests` khi GV thay xÃ¡c nháº­n).
 */
export async function POST(request: NextRequest) {
  try {
    const authGate = await requireBearerAdminOrSuperMutation(request);
    if (!authGate.ok) return authGate.response;

    await request.json().catch(() => ({}))
    return NextResponse.json({
      success: true,
      message:
        'Luá»“ng mail giáº£i trÃ¬nh / kiá»ƒm tra chuyÃªn sÃ¢u Ä‘Ã£ táº¯t. Chá»‰ cÃ²n mail quy trÃ¬nh xin nghá»‰.',
      skipped: true,
      emailNotSent: true,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lá»—i khÃ´ng xÃ¡c Ä‘á»‹nh'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
