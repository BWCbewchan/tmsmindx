import { requireBearerDbRoles } from '@/lib/auth-server'
import { getAccessibleCenters } from '@/lib/center-access'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const PAIRED_REGION_GROUPS = [
  ['HCM 1', 'HCM 4'],
  ['HCM 2', 'HCM 3'],
  ['HN 1', 'HN 2'],
]
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_RANGE_DAYS = 31

type Slot = {
  from: string
  to: string
}

type AccessibleCenter = {
  id: number
  full_name: string
  short_code: string | null
  region: string | null
  email?: string | null
}

type ScheduleRow = {
  ma_gv: string
  co_so_uu_tien: string[] | null
  linh_hoat: boolean | null
  gio_bat_dau: string
  gio_ket_thuc: string
  teacher_name: string | null
  khoi_final: string | null
  main_centre: string | null
  date_key: string
}

type Mentor = {
  ma_gv: string
  teacher_name: string
  gio_bat_dau: string
  gio_ket_thuc: string
  khoi_final: string | null
  main_centre_region: string | null
}

type CenterData = {
  short_code: string
  full_name: string
  region: string
  uu_tien: Mentor[]
  linh_hoat: Mentor[]
  total: number
}

type CenterAccumulator = Omit<CenterData, 'total'>

function normalizeKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function buildAllowedCenterKeys(centers: AccessibleCenter[]): Set<string> {
  return new Set(
    centers
      .flatMap((center) => [center.short_code ?? '', center.full_name])
      .map(normalizeKey)
      .filter(Boolean),
  )
}

function getGroupRegions(region: string): string[] {
  const group = PAIRED_REGION_GROUPS.find((regions) => regions.includes(region))
  return group ?? [region]
}

function isValidDateRange(start: string, end: string): boolean {
  if (!DATE_PATTERN.test(start) || !DATE_PATTERN.test(end)) return false
  const startMs = Date.parse(`${start}T00:00:00Z`)
  const endMs = Date.parse(`${end}T00:00:00Z`)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return false
  }
  return endMs - startMs <= MAX_RANGE_DAYS * 24 * 60 * 60 * 1000
}

function parseSlots(raw: string | null): Slot[] | null {
  if (!raw) return null
  const slots = raw.split(',').map((value) => {
    const [from, to] = value.split('-')
    return { from, to }
  })

  if (
    slots.length === 0 ||
    slots.length > 12 ||
    slots.some(
      ({ from, to }) =>
        !TIME_PATTERN.test(from) || !TIME_PATTERN.test(to) || from >= to,
    )
  ) {
    return null
  }

  return slots
}

function findMainCentreRegion(
  mainCentre: string | null,
  centers: AccessibleCenter[],
): string | null {
  const normalized = normalizeKey(mainCentre)
  if (!normalized) return null

  const exact = centers.find(
    (center) =>
      normalizeKey(center.full_name) === normalized ||
      normalizeKey(center.short_code) === normalized,
  )
  if (exact?.region) return exact.region.trim()

  const partial = centers.find((center) => {
    const fullName = normalizeKey(center.full_name)
    return fullName && (fullName.includes(normalized) || normalized.includes(fullName))
  })
  return partial?.region?.trim() || null
}

function addMentor(target: Mentor[], mentor: Mentor) {
  if (!target.some((item) => item.ma_gv === mentor.ma_gv)) {
    target.push(mentor)
  }
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireBearerDbRoles(request, [
      'super_admin',
      'admin',
      'manager',
    ])
    if (!gate.ok) return gate.response

    const { searchParams } = new URL(request.url)
    const batchStart = searchParams.get('start')
    const batchEnd = searchParams.get('end')
    const batchSlots = parseSlots(searchParams.get('slots'))
    const singleDate = searchParams.get('date')
    const singleFrom = searchParams.get('from')
    const singleTo = searchParams.get('to')
    const isBatchRequest = Boolean(batchStart || batchEnd || searchParams.get('slots'))

    let start: string
    let end: string
    let slots: Slot[]

    if (isBatchRequest) {
      if (!batchStart || !batchEnd || !batchSlots || !isValidDateRange(batchStart, batchEnd)) {
        return NextResponse.json(
          { success: false, error: 'Invalid start, end, or slots' },
          { status: 400 },
        )
      }
      start = batchStart
      end = batchEnd
      slots = batchSlots
    } else {
      if (
        !singleDate ||
        !singleFrom ||
        !singleTo ||
        !isValidDateRange(singleDate, singleDate) ||
        !TIME_PATTERN.test(singleFrom) ||
        !TIME_PATTERN.test(singleTo) ||
        singleFrom >= singleTo
      ) {
        return NextResponse.json(
          { success: false, error: 'Invalid date, from, or to' },
          { status: 400 },
        )
      }
      start = singleDate
      end = singleDate
      slots = [{ from: singleFrom, to: singleTo }]
    }

    const accessibleCentersPromise =
      gate.role === 'super_admin'
        ? Promise.resolve<AccessibleCenter[] | null>(null)
        : getAccessibleCenters(gate.sessionEmail)

    const [scheduleResult, centersResult, scopedCenters] = await Promise.all([
      pool.query(
        `SELECT
           d.ma_gv,
           d.co_so_uu_tien,
           d.linh_hoat,
           d.gio_bat_dau,
           d.gio_ket_thuc,
           TO_CHAR(d.ngay, 'YYYY-MM-DD') AS date_key,
           t.full_name AS teacher_name,
           COALESCE(t.main_centre, t."Main centre", t.centers) AS main_centre,
           t.khoi_final
         FROM dangky_lich_lam d
         LEFT JOIN teachers t ON LOWER(TRIM(t.code)) = LOWER(TRIM(d.ma_gv))
         WHERE d.ngay >= $1::date
           AND d.ngay <= $2::date
         ORDER BY d.ngay, d.ma_gv`,
        [start, end],
      ),
      pool.query(
        `SELECT id, short_code, full_name, region, email
         FROM centers
         WHERE status = 'Active'
         ORDER BY region, full_name`,
      ),
      accessibleCentersPromise,
    ])

    const allCenters = centersResult.rows as AccessibleCenter[]
    const accessibleCenters =
      gate.role === 'super_admin' ? allCenters : (scopedCenters ?? [])
    const allowedCenterKeys =
      gate.role === 'super_admin'
        ? null
        : buildAllowedCenterKeys(accessibleCenters)
    const availableCenters = allCenters.filter((center) => {
      if (!center.short_code || !center.region) return false
      if (!allowedCenterKeys) return true
      return (
        allowedCenterKeys.has(normalizeKey(center.short_code)) ||
        allowedCenterKeys.has(normalizeKey(center.full_name))
      )
    })
    const centerByCode = new Map(
      availableCenters.map((center) => [normalizeKey(center.short_code), center]),
    )

    const cells = new Map<string, Map<string, CenterAccumulator>>()
    const mainCentreRegions = new Map<string, string | null>()

    const getCellCenter = (
      cellKey: string,
      center: AccessibleCenter,
    ): CenterAccumulator => {
      let cell = cells.get(cellKey)
      if (!cell) {
        cell = new Map()
        cells.set(cellKey, cell)
      }

      const centerCode = String(center.short_code)
      let value = cell.get(centerCode)
      if (!value) {
        value = {
          short_code: centerCode,
          full_name: center.full_name,
          region: String(center.region),
          uu_tien: [],
          linh_hoat: [],
        }
        cell.set(centerCode, value)
      }
      return value
    }

    for (const row of scheduleResult.rows as ScheduleRow[]) {
      const rowStart = String(row.gio_bat_dau || '').slice(0, 5)
      const rowEnd = String(row.gio_ket_thuc || '').slice(0, 5)
      const mainCentreKey = normalizeKey(row.main_centre)
      if (!mainCentreRegions.has(mainCentreKey)) {
        mainCentreRegions.set(
          mainCentreKey,
          findMainCentreRegion(row.main_centre, allCenters),
        )
      }
      const mainCentreRegion = mainCentreRegions.get(mainCentreKey) ?? null
      const preferredCodes = row.co_so_uu_tien || []
      const preferredKeys = new Set(preferredCodes.map(normalizeKey))
      const groupRegions = mainCentreRegion
        ? getGroupRegions(mainCentreRegion)
        : []
      const mentor: Mentor = {
        ma_gv: row.ma_gv,
        teacher_name: row.teacher_name || row.ma_gv,
        gio_bat_dau: rowStart,
        gio_ket_thuc: rowEnd,
        khoi_final: row.khoi_final || null,
        main_centre_region: mainCentreRegion,
      }

      for (const slot of slots) {
        if (!(rowStart < slot.to && rowEnd > slot.from)) continue
        const cellKey = `${row.date_key}_${slot.from}_${slot.to}`

        for (const code of preferredCodes) {
          const center = centerByCode.get(normalizeKey(code))
          if (!center) continue
          addMentor(getCellCenter(cellKey, center).uu_tien, mentor)
        }

        if (row.linh_hoat) {
          for (const center of availableCenters) {
            if (
              !center.region ||
              !groupRegions.includes(center.region) ||
              preferredKeys.has(normalizeKey(center.short_code))
            ) {
              continue
            }
            addMentor(getCellCenter(cellKey, center).linh_hoat, mentor)
          }
        }
      }
    }

    const responseCells: Record<string, CenterData[]> = {}
    for (const [cellKey, centerMap] of cells) {
      responseCells[cellKey] = Array.from(centerMap.values())
        .map((center) => ({
          ...center,
          total: center.uu_tien.length + center.linh_hoat.length,
        }))
        .sort(
          (a, b) =>
            a.region.localeCompare(b.region) ||
            a.full_name.localeCompare(b.full_name),
        )
    }

    const meta = {
      centers: accessibleCenters
        .filter((center) => center.short_code)
        .map((center) => ({
          short_code: String(center.short_code),
          full_name: center.full_name,
        })),
      areas:
        gate.role === 'super_admin'
          ? null
          : Array.from(
              new Set(
                accessibleCenters
                  .map((center) => center.region?.trim())
                  .filter((region): region is string => Boolean(region)),
              ),
            ),
      isSuperAdmin: gate.role === 'super_admin',
    }

    if (isBatchRequest) {
      return NextResponse.json({ success: true, data: responseCells, meta })
    }

    const singleKey = `${start}_${slots[0].from}_${slots[0].to}`
    return NextResponse.json({
      success: true,
      data: responseCells[singleKey] || [],
      meta,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in admin lich-lam-viec:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
