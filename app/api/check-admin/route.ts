import { resolveAppUserAccessForEmail } from '@/lib/app-user-access'
import {
    rejectIfEmailNotSelf,
    requireBearerSession,
} from '@/lib/datasource-api-auth'
import { clientIpFromRequest, rateLimitOr429 } from '@/lib/rate-limit-memory'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const rl = rateLimitOr429(
    `check-admin:${clientIpFromRequest(request)}`,
    120,
    60_000,
  )
  if (rl) return rl

  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const emailParam = request.nextUrl.searchParams.get('email')
    let lookupEmail = auth.sessionEmail

    if (emailParam) {
      const target = emailParam.trim().toLowerCase()
      const denied = rejectIfEmailNotSelf(
        auth.sessionEmail,
        auth.privileged,
        target,
      )
      if (denied) return denied
      lookupEmail = target
    }

    // Tái sử dụng resolvedAccess từ requireBearerSession nếu là cùng email
    // → tránh gọi resolveAppUserAccessForEmail lần 2 cho cùng user trong 1 request
    const access =
      lookupEmail === auth.sessionEmail
        ? auth.resolvedAccess
        : await resolveAppUserAccessForEmail(lookupEmail)

    const responseBody = access.found
      ? {
          success: true,
          email: lookupEmail,
          isAdmin: access.isAdmin,
          isAppUser: access.isAppUser,
          role: access.role,
          permissions: access.permissions,
          userRoles: access.userRoles,
          assignedCenters: access.assignedCenters,
          message: 'Checked from app database',
        }
      : {
          success: true,
          email: lookupEmail,
          isAdmin: false,
          isAppUser: false,
          role: 'teacher',
          permissions: [],
          userRoles: [],
          assignedCenters: [],
          message: 'Email not found',
        }

    // Cache 30s ở browser cho user thường (permissions ít thay đổi)
    // Admin không cache để luôn lấy quyền mới nhất
    const cacheSeconds = access.isAdmin ? 0 : 30
    return NextResponse.json(responseBody, {
      headers: cacheSeconds > 0
        ? { 'Cache-Control': `private, max-age=${cacheSeconds}` }
        : { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Admin check error:', error)
    return NextResponse.json(
      {
        error: 'Failed to check admin status',
        isAdmin: false,
        isAppUser: false,
      },
      { status: 500 },
    )
  }
}
