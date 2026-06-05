/**
 * ═══════════════════════════════════════════════════════════════════════
 * lib/api-protection.ts — Lớp bảo vệ origin/referer cho API endpoints
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ## MỤC ĐÍCH
 * Lớp bảo vệ SƠ BỘ này kiểm tra xem request có đến từ giao diện ứng dụng không,
 * dựa trên Origin header, Referer header, và User-Agent.
 *
 * ## QUAN TRỌNG — GIỚI HẠN CỦA LỚP NÀY
 *
 * ⚠️ `withApiProtection` KHÔNG phải là lớp xác thực (authentication) thực sự.
 *    Nó chỉ là một bộ lọc sơ bộ để chặn các tool/script đơn giản.
 *
 * ⚠️ Mọi route handler bọc bởi `withApiProtection` VẪN PHẢI gọi:
 *    - `requireBearerSession(req)` để xác thực người dùng đã đăng nhập
 *    - `requireSameOriginMutation(req)` cho các mutation sử dụng cookie phiên
 *    - `rejectIfEmailNotSelf(...)` để ngăn user xem dữ liệu người khác
 *
 * ## TẠI SAO GIỮ LỚP NÀY?
 * Nó thêm một "cost" nhỏ cho kẻ tấn công — họ cần phải tạo request giả lập
 * browser thay vì dùng curl trực tiếp. Đây không phải là bảo vệ chính, mà là
 * defense-in-depth (bảo mật theo chiều sâu).
 *
 * ## LƯU Ý VỀ BEARER TOKEN BYPASS
 * `hasAuthToken = authHeader.startsWith('Bearer ')` — đây là kiểm tra sự HIỆN DIỆN
 * của header Authorization, không phải tính hợp lệ của token. Không coi đây là
 * bước xác thực; bước xác thực thực sự luôn nằm trong route handler.
 */

import { getApiSecret } from '@/lib/internal-api-secret';
import { NextRequest, NextResponse } from 'next/server';

// ─── Cấu hình Origins được phép ──────────────────────────────────────────────

/** Chuẩn hóa URL: xóa dấu slash cuối để so sánh chính xác. */
function normalizeAppOrigin(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Đọc danh sách URL ứng dụng từ biến môi trường.
 * NEXT_PUBLIC_APP_URL có thể chứa nhiều URL phân cách bằng dấu phẩy/chấm phẩy.
 * Ví dụ: "https://www.tpsmindx.com,https://tpsmindx.com"
 */
function parseAppUrlsFromEnv(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => normalizeAppOrigin(s))
    .filter(Boolean);
}

/**
 * Đọc danh sách origin bổ sung (ví dụ: staging URL, localhost production mirror).
 * Cấu hình trong .env, không hardcode trong source code.
 * Ví dụ ALLOWED_API_EXTRA_ORIGINS="https://staging.tpsmindx.com"
 */
function parseExtraAllowedOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => normalizeAppOrigin(s))
    .filter(Boolean);
}

// Tổng hợp danh sách origin được phép (chạy một lần khi module được load)
const ALLOWED_ORIGINS = Array.from(
  new Set<string>([
    ...parseExtraAllowedOrigins(process.env.ALLOWED_API_EXTRA_ORIGINS),
    ...parseAppUrlsFromEnv(process.env.NEXT_PUBLIC_APP_URL),
  ]),
);

// Development: cho phép localhost để không cản trở khi phát triển local
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://127.0.0.1:3000');
}

// API secret cho cron jobs và internal server-to-server calls
const API_SECRET_KEY = getApiSecret();

// ─── Hàm kiểm tra request ────────────────────────────────────────────────────

/**
 * Xác nhận request đến từ giao diện ứng dụng hoặc nguồn được ủy quyền.
 *
 * Thứ tự kiểm tra:
 *   1. Origin/Referer khớp với allowed origins → CHO PHÉP (browser request)
 *   2. Tool request (curl/wget/postman) → YÊU CẦU API key hoặc Bearer token
 *   3. Bearer token hoặc API key hợp lệ → CHO PHÉP (server-to-server)
 *   4. Origin không hợp lệ → TỪ CHỐI
 *   5. Không có nguồn gốc rõ ràng → TỪ CHỐI
 *
 * Lưu ý: Hàm này KHÔNG kiểm tra tính hợp lệ của Bearer token —
 * việc đó thuộc trách nhiệm của `requireBearerSession` trong route handler.
 */
export function validateInternalRequest(request: NextRequest): {
  isValid: boolean;
  error?: string;
} {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  
  // Kiểm tra xem request có đến từ cùng host không (same-origin browser request)
  const isSameOrigin = origin && host && (
    origin === `https://${host}` || 
    origin === `http://${host}`
  );
  
  // Kiểm tra origin có trong danh sách cho phép
  const isFromAllowedOrigin = origin && (
    isSameOrigin || 
    ALLOWED_ORIGINS.includes(origin)
  );
  
  // Kiểm tra referer có xuất phát từ domain cho phép
  const isFromAllowedReferer = referer && (
    (host && referer.includes(host)) ||
    ALLOWED_ORIGINS.some(allowedOrigin => referer.startsWith(allowedOrigin))
  );

  // API key server-to-server (cron jobs, internal tools)
  const apiKey = request.headers.get('x-api-key');
  const authHeader = request.headers.get('authorization');
  
  const hasValidApiKey = apiKey && apiKey === API_SECRET_KEY;
  // Kiểm tra sự HIỆN DIỆN của Bearer token (tính hợp lệ được kiểm tra bởi requireBearerSession)
  const hasAuthToken = authHeader && authHeader.startsWith('Bearer ');

  // Phát hiện tool phổ biến bên ngoài browser
  const userAgent = request.headers.get('user-agent') || '';
  const isToolRequest = (
    userAgent.toLowerCase().includes('curl') ||
    userAgent.toLowerCase().includes('wget') ||
    userAgent.toLowerCase().includes('postman')
  );

  // Browser request từ domain hợp lệ → CHO PHÉP
  if (isFromAllowedOrigin || isFromAllowedReferer) {
    return { isValid: true };
  }

  // Tool request → yêu cầu API key hoặc auth token
  if (isToolRequest) {
    if (!hasValidApiKey && !hasAuthToken) {
      return {
        isValid: false,
        error: 'Unauthorized: Tool requests require API key or authentication token'
      };
    }
    return { isValid: true };
  }

  // Server-to-server call với API key hoặc Bearer token → CHO PHÉP
  if (hasValidApiKey || hasAuthToken) {
    return { isValid: true };
  }

  // Origin có mặt nhưng không được phép → TỪ CHỐI và log cảnh báo
  if (origin && !isFromAllowedOrigin) {
    console.warn('[API Protection] Invalid origin:', origin, 'Expected:', ALLOWED_ORIGINS);
    return {
      isValid: false,
      error: `Forbidden: Invalid origin ${origin}`
    };
  }

  // Không có đủ thông tin xác nhận nguồn gốc → TỪ CHỐI
  return {
    isValid: false,
    error: 'Unauthorized: Missing origin, referer, or authentication'
  };
}

// ─── Response helpers ─────────────────────────────────────────────────────────

/** Tạo HTTP 403 response chuẩn hóa khi validation thất bại. */
export function createUnauthorizedResponse(error: string): NextResponse {
  return NextResponse.json(
    { 
      error: 'Access denied',
      message: 'This API endpoint can only be accessed through the application interface.',
      details: error
    },
    { 
      status: 403,
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      }
    }
  );
}

// ─── Higher-order wrapper ─────────────────────────────────────────────────────

/**
 * HOC bọc API handler với kiểm tra origin sơ bộ.
 *
 * Sử dụng cho các route cần lớp bảo vệ origin đầu tiên.
 *
 * ⚠️ QUAN TRỌNG: `withApiProtection` KHÔNG thay thế xác thực người dùng.
 * Route handler vẫn phải gọi `requireBearerSession` hoặc `requireBearerDbRoles`.
 *
 * @example
 * ```ts
 * async function handleGet(req: NextRequest) {
 *   const auth = await requireBearerSession(req); // Xác thực thực sự ở đây
 *   if (!auth.ok) return auth.response;
 *   // ... business logic
 * }
 * export const GET = withApiProtection(handleGet);
 * ```
 */
export function withApiProtection(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const validation = validateInternalRequest(request);
    
    if (!validation.isValid) {
      console.warn(`[API Protection] Blocked request: ${validation.error}`, {
        url: request.url,
        method: request.method,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      });
      
      return createUnauthorizedResponse(validation.error || 'Access denied');
    }

    return handler(request);
  };
}
