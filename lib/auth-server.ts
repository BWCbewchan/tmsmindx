import {
  resolveAppUserAccessForEmail,
  type AppUserAccess,
} from '@/lib/app-user-access';
import { requireSameOriginMutation } from '@/lib/api-security';
import { requireBearerSession } from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { normalizeAuthenticatedEmail } from '@/lib/security-identity';
import { NextRequest, NextResponse } from 'next/server';

export type DbRoleResult =
  | { ok: true; sessionEmail: string; role: string }
  | { ok: false; response: NextResponse };

export async function getDbRoleForEmail(
  email: string,
  preResolvedAccess?: AppUserAccess | null,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  try {
    const r = await pool.query(
      `SELECT role FROM app_users WHERE LOWER(email) = $1 AND is_active = true LIMIT 1`,
      [normalized],
    );
    const dbRole = (r.rows[0]?.role as string) ?? null
    if (dbRole && ['super_admin', 'admin', 'manager'].includes(dbRole)) {
      return dbRole
    }

    const access =
      preResolvedAccess ??
      (await resolveAppUserAccessForEmail(normalized))
    return access.found && access.isActive ? access.role : null
  } catch {
    return null;
  }
}

/** Trích xuất IP từ request headers */
function extractIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

/** Bearer hợp lệ + role DB thuộc tập cho phép (không tin role trong JWT). */
export async function requireBearerDbRoles(
  request: NextRequest,
  allowedRoles: string[],
): Promise<DbRoleResult> {
  const auth = await requireBearerSession(request);

  if (!auth.ok) {
    // ── Log: bearer không hợp lệ / chưa đăng nhập ──
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

  const role = await getDbRoleForEmail(sessionEmail, auth.resolvedAccess);

  if (!role || !allowedRoles.includes(role)) {
    // ── Log: đã đăng nhập nhưng không đủ quyền (privilege escalation attempt) ──
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

export async function requireBearerDbRolesMutation(
  request: NextRequest,
  allowedRoles: string[],
): Promise<DbRoleResult> {
  const originDenied = requireSameOriginMutation(request);
  if (originDenied) return { ok: false, response: originDenied };
  return requireBearerDbRoles(request, allowedRoles);
}

export async function requireBearerSuperAdmin(
  request: NextRequest,
): Promise<DbRoleResult> {
  return requireBearerDbRoles(request, ['super_admin']);
}

export async function requireBearerSuperAdminMutation(
  request: NextRequest,
): Promise<DbRoleResult> {
  return requireBearerDbRolesMutation(request, ['super_admin']);
}

/** super_admin hoặc admin (quản trị nội dung / S3 manager). */
export async function requireBearerAdminOrSuper(
  request: NextRequest,
): Promise<DbRoleResult> {
  return requireBearerDbRoles(request, ['super_admin', 'admin']);
}

export async function requireBearerAdminOrSuperMutation(
  request: NextRequest,
): Promise<DbRoleResult> {
  return requireBearerDbRolesMutation(request, ['super_admin', 'admin']);
}
