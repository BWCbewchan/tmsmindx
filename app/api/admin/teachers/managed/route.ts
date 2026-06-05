import { withApiProtection } from '@/lib/api-protection'
import { requireBearerOrSessionCookie } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

type TeacherListRow = {
  code: string
  full_name: string
  user_name: string
  work_email: string
  personal_email: string
  status: string
  main_centre: string
  centers: string
  khoi_final: string
  role: string
  te_quan_ly: string
  leader_quan_ly: string
  joined_date: string
}

function normalize(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function normalizeLeaderName(value: unknown): string {
  return normalize(value)
    .replace(
      /^(tegl\+?|teaching executive|teaching leader|leader|te|tc|cl|rl|al|ho|manager|admin)\s+/,
      '',
    )
    .replace(
      /\s+(tegl\+?|teaching executive|teaching leader|leader|te|tc|cl|rl|al|ho|manager|admin)$/,
      '',
    )
    .trim()
}

function splitTokens(value: unknown): string[] {
  return String(value ?? '')
    .split(/[\n,;|/]+/g)
    .map((part) => normalizeLeaderName(part))
    .filter(Boolean)
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function rowCenterTokens(row: TeacherListRow): string[] {
  return unique([
    ...splitTokens(row.main_centre),
    ...splitTokens(row.centers),
  ])
}

function rowManagerTokens(row: TeacherListRow): string[] {
  return unique([
    ...splitTokens(row.te_quan_ly),
    ...splitTokens(row.leader_quan_ly),
  ])
}

function managerMatches(row: TeacherListRow, identityTokens: Set<string>): boolean {
  if (identityTokens.size === 0) return false
  return rowManagerTokens(row).some((token) => identityTokens.has(token))
}

function queryMatches(row: TeacherListRow, query: string): boolean {
  if (!query) return true
  const haystack = [
    row.code,
    row.full_name,
    row.user_name,
    row.work_email,
    row.personal_email,
    row.main_centre,
    row.centers,
    row.te_quan_ly,
    row.leader_quan_ly,
  ]
    .map(normalize)
    .join(' ')
  return haystack.includes(query)
}

function parseSelectedCenters(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return unique(parsed.map(normalize).filter(Boolean))
    }
  } catch {
    // Fall through to delimiter parsing.
  }

  return unique(raw.split(',').map(normalize).filter(Boolean))
}

function selectedCenterMatches(
  row: TeacherListRow,
  selectedCenters: Set<string>,
): boolean {
  if (selectedCenters.size === 0) return true
  return rowCenterTokens(row).some((center) => selectedCenters.has(center))
}

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const auth = await requireBearerOrSessionCookie(request)
    if (!auth.ok) return auth.response

    const searchParams = request.nextUrl.searchParams
    const query = normalize(searchParams.get('query'))
    const selectedCenters = new Set(
      parseSelectedCenters(
        searchParams.get('centers') ?? searchParams.get('center'),
      ),
    )
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const pageSize = Math.min(
      10,
      Math.max(1, Number(searchParams.get('pageSize') || 10)),
    )

    const [teachersResult, userResult] = await Promise.all([
      pool.query<TeacherListRow>(
        `
        SELECT
          COALESCE(code, '') AS code,
          COALESCE(full_name, "Full name", '') AS full_name,
          COALESCE(user_name, "User name", '') AS user_name,
          COALESCE(work_email, "Work email", '') AS work_email,
          COALESCE(personal_email, '') AS personal_email,
          COALESCE(status, status_check, status_update, "Status", 'Active') AS status,
          COALESCE(main_centre, "Main centre", '') AS main_centre,
          COALESCE(centers, '') AS centers,
          COALESCE(khoi_final, khoi_check, '') AS khoi_final,
          COALESCE(role, '') AS role,
          COALESCE(te_quan_ly, '') AS te_quan_ly,
          COALESCE(leader_quan_ly, '') AS leader_quan_ly,
          COALESCE(joined_date::text, '') AS joined_date
        FROM teachers
        WHERE COALESCE(code, '') <> ''
        ORDER BY LOWER(COALESCE(full_name, "Full name", code, '')) ASC
        `,
      ),
      pool.query(
        `
        SELECT
          COALESCE(u.display_name, '') AS display_name,
          COALESCE(u.email, '') AS email,
          COALESCE(t.full_name, t."Full name", '') AS teacher_full_name,
          COALESCE(t.user_name, t."User name", '') AS teacher_user_name,
          COALESCE(t.code, '') AS teacher_code,
          COALESCE(tl.full_name, '') AS leader_full_name,
          COALESCE(tl.code, '') AS leader_code,
          COALESCE(tl.role_name, '') AS leader_role_name
        FROM app_users u
        LEFT JOIN teachers t
          ON LOWER(TRIM(COALESCE(t.work_email, t."Work email", ''))) = LOWER(TRIM(u.email))
        LEFT JOIN teaching_leaders tl
          ON LOWER(TRIM(COALESCE(tl.email, ''))) = LOWER(TRIM(u.email))
          OR (
            COALESCE(t.code, '') <> ''
            AND LOWER(TRIM(COALESCE(tl.code, ''))) = LOWER(TRIM(t.code))
          )
        WHERE LOWER(TRIM(u.email)) = LOWER(TRIM($1))
          AND u.is_active = true
        LIMIT 1
        `,
        [auth.sessionEmail],
      ),
    ])

    const identityTokens = new Set(
      unique([
        normalizeLeaderName(auth.sessionEmail),
        normalizeLeaderName(auth.sessionEmail.split('@')[0]),
        normalizeLeaderName(userResult.rows[0]?.display_name),
        normalizeLeaderName(userResult.rows[0]?.teacher_full_name),
        normalizeLeaderName(userResult.rows[0]?.teacher_user_name),
        normalizeLeaderName(userResult.rows[0]?.teacher_code),
        normalizeLeaderName(userResult.rows[0]?.leader_full_name),
        normalizeLeaderName(userResult.rows[0]?.leader_code),
      ]),
    )

    const scopedRows = auth.privileged
      ? teachersResult.rows
      : teachersResult.rows.filter((row) => managerMatches(row, identityTokens))

    const filteredRows = scopedRows.filter(
      (row) =>
        queryMatches(row, query) && selectedCenterMatches(row, selectedCenters),
    )

    const centers = unique(
      scopedRows.flatMap((row) => rowCenterTokens(row)),
    ).sort((a, b) => a.localeCompare(b, 'vi'))

    const total = filteredRows.length
    const pageCount = Math.max(1, Math.ceil(total / pageSize))
    const safePage = Math.min(page, pageCount)
    const start = (safePage - 1) * pageSize

    return NextResponse.json({
      success: true,
      teachers: filteredRows.slice(start, start + pageSize),
      workEmails: unique(filteredRows.map((row) => row.work_email.trim())),
      personalEmails: unique(filteredRows.map((row) => row.personal_email.trim())),
      centers,
      total,
      page: safePage,
      pageSize,
      pageCount,
      isSuperAdmin: auth.privileged,
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Không thể tải danh sách giáo viên'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
