/**
 * ═══════════════════════════════════════════════════════════════════════
 * lib/auth-server.ts — Lớp xác thực vai trò (Role-Based Authorization)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ## MÔ HÌNH BẢO MẬT TỔNG QUAN (SECURITY MODEL)
 *
 * App này có 3 lớp bảo vệ xếp chồng lên nhau:
 *
 *   1. [PROXY LAYER] — proxy.ts
 *      Kiểm tra cookie phiên trước khi request đến route handler.
 *      Bảo vệ: /admin/*, /api/admin/*, /api/database/*, /api/debug/*, /api/app-auth/* (trừ /login)
 *      KHÔNG kiểm tra: các /api/* route thông thường — chúng phải tự enforce auth.
 *
 *   2. [ORIGIN / CSRF LAYER] — lib/api-security.ts (requireSameOriginMutation)
 *      Chặn các yêu cầu POST/PUT/PATCH/DELETE từ origin không hợp lệ (CSRF).
 *      Bearer token hợp lệ bypass layer này vì server-to-server call không có origin header.
 *
 *   3. [AUTHENTICATION + AUTHORIZATION LAYER] — file này (lib/auth-server.ts)
 *      Xác minh Bearer JWT hoặc cookie `tps_session` hợp lệ.
 *      SAU ĐÓ re-query DB để lấy role thực tế (KHÔNG tin role trong JWT).
 *      Đây là lớp quyết định cuối cùng.
 *
 * ## CÁC ROLE TRONG HỆ THỐNG
 *
 *   - `super_admin`: Toàn quyền, bypass mọi kiểm tra email ownership.
 *   - `admin`:       Quản trị nội dung, S3 uploads, review leave requests, v.v.
 *   - `manager`:     Quản lý trung tâm, xem dữ liệu theo cơ sở được phân công.
 *   - (teacher/user): Chỉ thao tác với dữ liệu của chính mình.
 *
 * ## NGUYÊN TẮC "KHÔNG TIN JWT ROLE"
 *
 *   JWT chứa role lúc đăng nhập. Nếu admin thay đổi role của user sau đó,
 *   JWT cũ vẫn có role cũ cho đến khi hết hạn (30 ngày).
 *   Để tránh rủi ro leo thang đặc quyền, mọi API nhạy cảm đều phải gọi
 *   `getDbRoleForEmail()` để lấy role HIỆN TẠI từ DB thay vì tin vào JWT.
 *
 * ## LUỒNG XỬ LÝ ĐIỂN HÌNH CHO API ADMIN
 *
 *   export async function POST(req: NextRequest) {
 *     // Bước 1: CSRF check + Session check + DB role check
 *     const auth = await requireBearerAdminOrSuperMutation(req);
 *     if (!auth.ok) return auth.response; // 401 hoặc 403
 *
 *     // Bước 2: Thực thi business logic với auth.sessionEmail và auth.role
 *   }
 *
 * ## LUỒNG XỬ LÝ ĐIỂN HÌNH CHO API GIÁO VIÊN (TỰ XEM DỮ LIỆU CỦA MÌNH)
 *
 *   export async function GET(req: NextRequest) {
 *     const auth = await requireBearerSession(req);
 *     if (!auth.ok) return auth.response;
 *
 *     const targetEmail = req.nextUrl.searchParams.get('email');
 *     // Đảm bảo user không thể xem dữ liệu của người khác
 *     const denied = rejectIfEmailNotSelf(auth.sessionEmail, auth.privileged, targetEmail);
 *     if (denied) return denied;
 *   }
 */

import {
  resolveAppUserAccessForEmail,
  type AppUserAccess,
} from '@/lib/app-user-access';
import { requireSameOriginMutation } from '@/lib/api-security';
import { requireBearerSession } from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { normalizeAuthenticatedEmail } from '@/lib/security-identity';
import { NextRequest, NextResponse } from 'next/server';

// ─── Kiểu dữ liệu trả về ─────────────────────────────────────────────────────

export type DbRoleResult =
  | { ok: true; sessionEmail: string; role: string }
  | { ok: false; response: NextResponse };

// ─── Tra cứu role từ DB (không tin JWT) ──────────────────────────────────────

/**
 * Lấy role HIỆN TẠI của user từ cơ sở dữ liệu.
 *
 * Thứ tự ưu tiên:
 *   1. Bảng `app_users` (super_admin, admin, manager) — tra cứu trực tiếp.
 *   2. Bảng teacher data thông qua `resolveAppUserAccessForEmail` — cho giáo viên thường.
 *
 * Trả về `null` nếu user không tồn tại hoặc không active.
 *
 * @param preResolvedAccess Kết quả resolve sẵn từ session auth (tránh gọi DB 2 lần).
 */
export async function getDbRoleForEmail(
  email: string,
  preResolvedAccess?: AppUserAccess | null,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  try {
    // Kiểm tra bảng app_users trước cho các role quản trị viên
    const r = await pool.query(
      `SELECT role FROM app_users WHERE LOWER(email) = $1 AND is_active = true LIMIT 1`,
      [normalized],
    );
    const dbRole = (r.rows[0]?.role as string) ?? null;
    // Nếu là role quản trị → trả về luôn, không cần kiểm tra thêm
    if (dbRole && ['super_admin', 'admin', 'manager'].includes(dbRole)) {
      return dbRole;
    }

    // Dùng kết quả resolve sẵn nếu có, hoặc tra cứu lại từ DB
    const access =
      preResolvedAccess ??
      (await resolveAppUserAccessForEmail(normalized));
    return access.found && access.isActive ? access.role : null;
  } catch {
    // Trả về null nếu DB không phản hồi — caller sẽ xử lý 403
    return null;
  }
}

// ─── Helper: Trích xuất IP từ headers ────────────────────────────────────────

/**
 * Trích xuất IP thực của client từ các headers tiêu chuẩn của reverse proxy.
 * Thứ tự ưu tiên: X-Forwarded-For (Vercel/Cloudflare) → X-Real-IP → 'unknown'
 */
function extractIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

// ─── Core authorization check: Bearer + DB role ───────────────────────────────

/**
 * Xác thực phiên Bearer (hoặc cookie) VÀ kiểm tra role từ DB.
 *
 * Lý do KHÔNG tin role trong JWT:
 *   JWT có hạn 30 ngày. Nếu admin revoke quyền của user sau khi JWT được cấp,
 *   user vẫn có thể sử dụng JWT cũ. Re-query DB đảm bảo quyền luôn là hiện tại.
 *
 * Ghi audit log cho mọi trường hợp thất bại:
 *   - 401: không có session hợp lệ (chưa đăng nhập)
 *   - 403: đã đăng nhập nhưng không đủ quyền (có thể là privilege escalation)
 *
 * @param allowedRoles Danh sách role được phép, ví dụ: ['super_admin', 'admin']
 */
export async function requireBearerDbRoles(
  request: NextRequest,
  allowedRoles: string[],
): Promise<DbRoleResult> {
  // Bước 1: Xác thực Bearer token hoặc cookie phiên
  const auth = await requireBearerSession(request);

  if (!auth.ok) {
    // Người dùng chưa đăng nhập hoặc token không hợp lệ
    const { logUnauthorizedAccess } = await import('@/lib/audit-logger');
    logUnauthorizedAccess({
      email:        null,
      role:         null,
      ip:           extractIp(request),
      userAgent:    request.headers.get('user-agent') ?? '',
      endpoint:     `${request.method} ${request.nextUrl.pathname}`,
      requiredRole: allowedRoles.join('|'),
    });
    return { ok: false, response: auth.response };
  }

  // Bước 2: Normalize email từ session (phòng tránh spoofing với giá trị đặc biệt)
  const sessionEmail = normalizeAuthenticatedEmail(auth.sessionEmail);
  if (!sessionEmail) {
    const { logUnauthorizedAccess } = await import('@/lib/audit-logger');
    logUnauthorizedAccess({
      email:        null,
      role:         null,
      ip:           extractIp(request),
      userAgent:    request.headers.get('user-agent') ?? '',
      endpoint:     `${request.method} ${request.nextUrl.pathname}`,
      requiredRole: allowedRoles.join('|'),
    });
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Phiên đăng nhập không có email xác thực hợp lệ' },
        { status: 401 },
      ),
    };
  }

  // Bước 3: Re-query DB để lấy role thực tế (KHÔNG dùng role trong JWT)
  const role = await getDbRoleForEmail(sessionEmail, auth.resolvedAccess);

  if (!role || !allowedRoles.includes(role)) {
    // Người dùng đã đăng nhập nhưng không đủ quyền — ghi log với severity HIGH
    const { logUnauthorizedAccess } = await import('@/lib/audit-logger');
    logUnauthorizedAccess({
      email:        sessionEmail,
      role:         role ?? 'unknown',
      ip:           extractIp(request),
      userAgent:    request.headers.get('user-agent') ?? '',
      endpoint:     `${request.method} ${request.nextUrl.pathname}`,
      requiredRole: allowedRoles.join('|'),
    });
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Không có quyền thực hiện thao tác này' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, sessionEmail, role };
}

// ─── Mutation variant (bao gồm CSRF check) ────────────────────────────────────

/**
 * Như `requireBearerDbRoles` nhưng THÊM kiểm tra CSRF (same-origin) cho các
 * request mutation (POST/PUT/PATCH/DELETE) sử dụng cookie phiên.
 *
 * Bearer token hợp lệ bypass CSRF check vì server-to-server call không có origin header.
 * Cookie-based request PHẢI đến từ cùng origin để tránh tấn công CSRF.
 *
 * Dùng hàm này cho mọi API admin thực hiện thay đổi dữ liệu.
 */
export async function requireBearerDbRolesMutation(
  request: NextRequest,
  allowedRoles: string[],
): Promise<DbRoleResult> {
  // CSRF check phải được thực hiện TRƯỚC khi đọc request body
  const originDenied = requireSameOriginMutation(request);
  if (originDenied) return { ok: false, response: originDenied };
  return requireBearerDbRoles(request, allowedRoles);
}

// ─── Convenience wrappers ──────────────────────────────────────────────────────

/**
 * Chỉ cho phép `super_admin` (đọc dữ liệu, không mutation).
 * Ví dụ: API xuất dữ liệu nhạy cảm toàn hệ thống.
 */
export async function requireBearerSuperAdmin(
  request: NextRequest,
): Promise<DbRoleResult> {
  return requireBearerDbRoles(request, ['super_admin']);
}

/**
 * Chỉ cho phép `super_admin` thực hiện mutation.
 * Ví dụ: API xóa user, thay đổi cấu hình hệ thống.
 */
export async function requireBearerSuperAdminMutation(
  request: NextRequest,
): Promise<DbRoleResult> {
  return requireBearerDbRolesMutation(request, ['super_admin']);
}

/**
 * Cho phép `super_admin` hoặc `admin` đọc dữ liệu.
 * Ví dụ: Quản lý nội dung, xem danh sách S3 objects.
 */
export async function requireBearerAdminOrSuper(
  request: NextRequest,
): Promise<DbRoleResult> {
  return requireBearerDbRoles(request, ['super_admin', 'admin']);
}

/**
 * Cho phép `super_admin` hoặc `admin` thực hiện mutation (kèm CSRF check).
 * Ví dụ: Upload video bài giảng, xóa file S3, tạo bộ đề thi.
 */
export async function requireBearerAdminOrSuperMutation(
  request: NextRequest,
): Promise<DbRoleResult> {
  return requireBearerDbRolesMutation(request, ['super_admin', 'admin']);
}
