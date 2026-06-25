/**
 * ═══════════════════════════════════════════════════════════════════════
 * lib/api-security.ts — CSRF Protection cho mutation API endpoints
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ## MỤC ĐÍCH
 * Ngăn chặn tấn công CSRF (Cross-Site Request Forgery) cho các request
 * POST/PUT/PATCH/DELETE sử dụng cookie phiên (`tps_session`).
 *
 * ## TẠI SAO CẦN CSRF PROTECTION?
 *
 * Cookie `tps_session` tự động được gửi kèm theo mọi request từ browser
 * đến domain tpsmindx.com, kể cả khi request đến từ trang web khác.
 *
 * Kịch bản tấn công CSRF:
 *   1. Giáo viên đang đăng nhập tpsmindx.com (có cookie hợp lệ)
 *   2. Họ vô tình truy cập trang evil.com
 *   3. evil.com gửi form POST đến https://tpsmindx.com/api/leave-requests
 *   4. Browser tự động đính kèm cookie → server chấp nhận request độc hại!
 *
 * ## CÁCH HOẠT ĐỘNG
 *
 * Hàm `requireSameOriginMutation` kiểm tra Origin và Referer header để đảm bảo
 * request đến từ đúng domain của ứng dụng.
 *
 * Bearer token BYPASS CSRF check vì:
 *   - Server-to-server call không có Origin header
 *   - Bearer token không được browser tự động gửi → không bị CSRF
 *   - Kẻ tấn công cần đánh cắp token mới dùng được (khó hơn nhiều)
 *
 * ## KHI NÀO DÙNG HÀM NÀY?
 *
 * Bắt buộc gọi cho mọi mutation route chấp nhận COOKIE SESSION:
 *   - Route dùng `requireBearerSession` (chấp nhận cả Bearer + cookie)
 *   - Route dùng `requireBearerOrSessionCookie`
 *
 * Không cần thiết cho route:
 *   - Chỉ chấp nhận Bearer token (không cookie)
 *   - Route GET/HEAD (không thay đổi dữ liệu)
 *   - Login endpoint (cần mở rộng để nhận request từ form)
 *
 * ## CẤU HÌNH ORIGIN
 * - `NEXT_PUBLIC_APP_URL`: URL chính của ứng dụng (bắt buộc)
 * - `ALLOWED_API_EXTRA_ORIGINS`: URL bổ sung nếu app chạy trên nhiều domain
 */

import { OFFICIAL_APP_ORIGINS } from '@/lib/allowed-app-origins';
import { NextRequest, NextResponse } from 'next/server';

/** Các HTTP method tạo ra side-effect (thay đổi dữ liệu). */
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Xóa dấu slash cuối để so sánh origin chính xác. */
function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

/**
 * Đọc và parse danh sách origin được phép từ biến môi trường.
 * Hỗ trợ nhiều URL phân cách bằng dấu phẩy, chấm phẩy hoặc khoảng trắng.
 */
function parseConfiguredOrigins(): string[] {
  const rawValues = [
    ...OFFICIAL_APP_ORIGINS,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.ALLOWED_API_EXTRA_ORIGINS,
  ].filter(Boolean);

  return Array.from(
    new Set(
      rawValues
        .flatMap((raw) => String(raw).split(/[,;\s]+/g))
        .map((value) => normalizeOrigin(value))
        .filter(Boolean),
    ),
  );
}

/**
 * Tập hợp các origin được coi là "cùng ứng dụng" cho request này.
 * Bao gồm: URL từ request, host header, và các URL được cấu hình trong .env.
 */
function requestOrigins(request: NextRequest): Set<string> {
  const origins = new Set<string>();

  // Origin từ URL thực của request (Vercel/server-side)
  try {
    origins.add(new URL(request.url).origin);
  } catch {
    // URL không parse được — bỏ qua, host header phía dưới vẫn áp dụng
  }

  // Thêm từ Host header (đáng tin cậy hơn từ reverse proxy)
  const host = request.headers.get('host')?.trim();
  if (host) {
    origins.add(`https://${host}`);
    if (process.env.NODE_ENV !== 'production') {
      origins.add(`http://${host}`); // Cho phép HTTP trong development
    }
  }

  // Development: localhost luôn được phép để không cản trở developer
  if (process.env.NODE_ENV === 'development') {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }

  // Thêm các origin từ biến môi trường
  for (const origin of parseConfiguredOrigins()) {
    origins.add(origin);
  }

  return origins;
}

/**
 * Kiểm tra CSRF cho các mutation request.
 *
 * Trả về `null` nếu request hợp lệ (được phép tiếp tục).
 * Trả về `NextResponse` lỗi 403 nếu request bị nghi ngờ là CSRF.
 *
 * Các trường hợp BYPASS (không cần CSRF check):
 *   1. Request không phải mutation method (GET, HEAD, OPTIONS) → `null`
 *   2. Request có Bearer token → `null` (server-to-server call, không bị CSRF)
 *   3. Origin header khớp với allowed origins → `null`
 *   4. Referer header xuất phát từ allowed origin → `null`
 *   5. Không có Origin/Referer nhưng Sec-Fetch-Site = same-origin → `null` (browser đảm bảo)
 *
 * @example Sử dụng đúng trong mutation handler:
 * ```ts
 * export async function PUT(req: NextRequest) {
 *   const csrfDenied = requireSameOriginMutation(req);
 *   if (csrfDenied) return csrfDenied; // 403 Forbidden
 *
 *   const auth = await requireBearerSession(req);
 *   if (!auth.ok) return auth.response; // 401 Unauthorized
 *
 *   // ... thực hiện thay đổi dữ liệu
 * }
 * ```
 */
export function requireSameOriginMutation(request: NextRequest): NextResponse | null {
  // 1. Chỉ kiểm tra các method tạo side-effect
  if (!MUTATION_METHODS.has(request.method.toUpperCase())) return null;

  // 2. Bearer token bypass: server call không có origin, CSRF không áp dụng
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) return null;

  const allowedOrigins = requestOrigins(request);

  // 3. Origin header hợp lệ
  const origin = request.headers.get('origin')?.trim();
  if (origin && allowedOrigins.has(normalizeOrigin(origin))) return null;

  // 4. Referer header xuất phát từ domain hợp lệ
  const referer = request.headers.get('referer')?.trim();
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (allowedOrigins.has(refererOrigin)) return null;
    } catch {
      // Referer không parse được → tiếp tục kiểm tra
    }
  }

  // 5. Không có Origin/Referer nhưng browser đảm bảo same-origin qua Sec-Fetch-Site
  const secFetchSite = request.headers.get('sec-fetch-site')?.toLowerCase();
  if (!origin && !referer && secFetchSite === 'same-origin') return null;

  // Tất cả kiểm tra thất bại → từ chối request như tấn công CSRF tiềm năng
  return NextResponse.json(
    { success: false, error: 'Request khong hop le: yeu cau thao tac tu dung ung dung.' },
    { status: 403 },
  );
}
