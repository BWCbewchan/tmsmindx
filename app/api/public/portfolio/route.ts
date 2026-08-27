import { getPublishedPortfolioBySlug } from '@/lib/student-portfolio/service';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('slug') || '';
    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'Thiếu slug portfolio' },
        { status: 400 },
      );
    }

    const portfolio = await getPublishedPortfolioBySlug(slug);
    if (!portfolio) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy portfolio public' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, portfolio });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải portfolio';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

