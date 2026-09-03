import { requireBearerSession } from '@/lib/datasource-api-auth';
import { isPortfolioAllowedUser } from '@/lib/menu-permissions';
import { deletePortfolioById } from '@/lib/student-portfolio/service';
import { NextRequest, NextResponse } from 'next/server';

const PORTFOLIO_ACCESS_ERROR =
  'Chỉ tài khoản TEGL, TEGL+, TM, CL, RL, AL, LEAD, TE, TC hoặc super_admin mới có quyền truy cập portfolio';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireBearerSession(req);
    if (auth.ok === false) return auth.response;

    if (!isPortfolioAllowedUser(auth.resolvedAccess)) {
      return NextResponse.json(
        { success: false, error: PORTFOLIO_ACCESS_ERROR },
        { status: 403 },
      );
    }

    const { id } = await params;
    const isSuperAdmin = auth.resolvedAccess.role === 'super_admin';
    const centreNames = isSuperAdmin
      ? []
      : auth.accessibleCenters.map((center) => center.full_name).filter(Boolean);
    const deleted = await deletePortfolioById(id, { centreNames });

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy portfolio' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể xóa portfolio';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
