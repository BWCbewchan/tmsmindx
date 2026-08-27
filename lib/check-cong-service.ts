import { promises as fs } from 'fs'
import { createHash } from 'crypto'
import path from 'path'

export type CheckCongRecord = {
  checkKey: string
  centre: string
  type: string
  className: string
  course: string
  courseLine: string
  teacherName: string
  workEmail: string
  personalEmail: string
  username: string
  roleType: string
  status: string
  slotTime: string
  slotDuration: number
  effectiveDuration: number
  studentCount: number | null
  note: string
  managerNote: string
  confirmStatus: string
  confirmNote: string
  salaryAmount: number | null
  salaryRule: string
  payHours: number
}

export type CheckCongSummary = {
  totalRecords: number
  checkedRecords: number
  uncheckedRecords: number
  classSessions: number
  officeHours: number
  totalSlotDuration: number
  totalEffectiveDuration: number
  estimatedSalary: number | null
  grossEstimatedSalary: number | null
  salaryTaxAmount: number | null
  checkRate: number
  monthLabel: string
}

type AdminTeacherRankingItem = {
  teacherName: string
  username: string
  workEmail: string
  checkedRecords: number
  totalRecords: number
  centres: string[]
}

type AdminMonthBase = {
  scoped: CheckCongRecord[]
  summary: CheckCongSummary
  analytics: {
    teacherCount: number
    checkedByType: Record<string, number>
    teacherRanking: AdminTeacherRankingItem[]
    topTeachers: AdminTeacherRankingItem[]
    monthLabel: string
  }
}

const CSV_PATH =
  process.env.CHECK_CONG_CSV_PATH ||
  path.join(process.cwd(), 'public', 'data', 'check-cong-class.csv')

let cached:
  | {
      loadedAt: number
      mtimeMs: number
      records: CheckCongRecord[]
    }
  | undefined

let adminBaseCache:
  | {
      mtimeMs: number
      months: string[]
      byMonth: Map<string, AdminMonthBase>
    }
  | undefined

function parseCSVRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuote = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (char === '"') {
      if (inQuote && text[i + 1] === '"') {
        cell += '"'
        i++
      } else {
        inQuote = !inQuote
      }
    } else if (char === ',' && !inQuote) {
      row.push(cell.trim())
      cell = ''
    } else if ((char === '\n' || char === '\r') && !inQuote) {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(cell.trim())
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  if (cell || row.length > 0) {
    row.push(cell.trim())
    if (row.some((value) => value !== '')) rows.push(row)
  }

  return rows
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function toNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function toNullableNumber(value: string): number | null {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isOneOnOneClass(className: string): boolean {
  return /(?:^|[-_\s])1-(?:1|2|3)(?:$|[-_\s])/i.test(className)
}

function trialOfflineSalary(record: {
  studentCount: number | null
  confirmStatus: string
}): Pick<CheckCongRecord, 'salaryAmount' | 'salaryRule' | 'payHours'> {
  const status = normalizeToken(record.confirmStatus)
  if (status.includes('gvien k truc') || status.includes('giao vien k truc')) {
    return { salaryAmount: 0, salaryRule: 'Trial offline cancel - không trực', payHours: 0 }
  }
  if (status.includes('truc 30p')) {
    return { salaryAmount: 50000, salaryRule: 'Trial offline cancel - trực 30 phút', payHours: 0.5 }
  }
  if (status.includes('huy') && status.includes('truc het gio')) {
    return { salaryAmount: 80000, salaryRule: 'Trial offline cancel - trực hết giờ', payHours: 0 }
  }

  const students = Math.max(0, record.studentCount ?? 0)
  return {
    salaryAmount: Math.min(300000, 80000 + students * 30000),
    salaryRule: 'Trial offline/FIXED: 80k + 30k/học viên, tối đa 300k',
    payHours: 0,
  }
}

function trialOnlineSalary(record: {
  studentCount: number | null
  confirmStatus: string
}): {
  salaryAmount: number
  salaryRule: string
  payHours: number
} {
  if (normalizeToken(record.confirmStatus).includes('huy')) {
    return {
      salaryAmount: 40000,
      salaryRule: 'Trial online cancel sát giờ: 40k',
      payHours: 0,
    }
  }

  const students = Math.max(0, Math.min(record.studentCount ?? 0, 3))
  const amount = students <= 1 ? 40000 : students === 2 ? 60000 : 80000
  return {
    salaryAmount: amount,
    salaryRule: 'Trial online: 40k/1 HV, 60k/2 HV, 80k/3 HV',
    payHours: 0,
  }
}

function calculateSalary(
  record: Omit<
    CheckCongRecord,
    'salaryAmount' | 'salaryRule' | 'payHours'
  >,
  hourlyRate: number | null,
): Pick<CheckCongRecord, 'salaryAmount' | 'salaryRule' | 'payHours'> {
  if (record.status !== 'CHECKED') {
    return { salaryAmount: 0, salaryRule: 'Unchecked - không tính lương', payHours: 0 }
  }

  const role = normalizeToken(record.roleType)
  const type = normalizeToken(record.type)
  const hours = record.effectiveDuration || record.slotDuration || 0
  const students = record.studentCount ?? 0

  if (type === 'class') {
    if (!hourlyRate) {
      return { salaryAmount: null, salaryRule: 'Thiếu rate theo giờ', payHours: hours }
    }

    if (role === 'ta') {
      return {
        salaryAmount: Math.round(hourlyRate * hours * 0.75),
        salaryRule: 'CLASS TA: 75% x rate x giờ',
        payHours: hours,
      }
    }

    if (role === 'lec') {
      const multiplier =
        students > 3 || isOneOnOneClass(record.className) ? 1 : 0.75
      return {
        salaryAmount: Math.round(hourlyRate * hours * multiplier),
        salaryRule:
          multiplier === 1
            ? 'CLASS LEC: 100% x rate x giờ'
            : 'CLASS LEC thiếu sĩ số: 75% x rate x giờ',
        payHours: hours,
      }
    }

    return {
      salaryAmount: Math.round(hourlyRate * hours),
      salaryRule: 'CLASS vai trò khác: 100% x rate x giờ',
      payHours: hours,
    }
  }

  if (type === 'office_hours') {
    if (role === 'trial') return trialOnlineSalary(record)
    if (role === 'fixed') return trialOfflineSalary(record)

    if (role === 'makeup') {
      if (!hourlyRate) {
        return { salaryAmount: null, salaryRule: 'Thiếu rate theo giờ', payHours: hours }
      }
      const payHours = students > 3 ? hours : Math.min(hours, 1)
      const multiplier = students > 3 ? 1 : 0.75
      return {
        salaryAmount: Math.round(hourlyRate * payHours * multiplier),
        salaryRule:
          students > 3
            ? 'MAKE UP > 3 HV: 100% x rate x giờ'
            : 'MAKE UP <= 3 HV: 75% x rate x 1 giờ/ca',
        payHours,
      }
    }

    if (!hourlyRate) {
      return { salaryAmount: null, salaryRule: 'Thiếu rate theo giờ', payHours: hours }
    }
    return {
      salaryAmount: Math.round(hourlyRate * hours),
      salaryRule: 'Office hours khác: 100% x rate x giờ',
      payHours: hours,
    }
  }

  return { salaryAmount: 0, salaryRule: 'Không xác định loại công', payHours: 0 }
}

function makeCheckCongKey(record: {
  centre: string
  type: string
  className: string
  course: string
  courseLine: string
  teacherName: string
  workEmail: string
  personalEmail: string
  username: string
  roleType: string
  slotTime: string
}): string {
  const raw = [
    record.workEmail,
    record.personalEmail,
    record.username,
    record.teacherName,
    record.slotTime,
    record.type,
    record.roleType,
    record.className,
    record.course,
    record.courseLine,
    record.centre,
  ]
    .map(normalizeSearchText)
    .join('|')
  return createHash('sha1').update(raw).digest('hex')
}

function rowToRecord(row: Record<string, string>): CheckCongRecord {
  const base = {
    centre: row['Centre shortname'] || '',
    type: row.Type || '',
    className: row['Class name'] || '',
    course: row.Course || '',
    courseLine: row['Course Line'] || '',
    teacherName: row['Teacher name'] || '',
    workEmail: row['Work email'] || '',
    personalEmail: row['Personal email'] || '',
    username: row.Username || '',
    roleType: row['Class role/Office hour type'] || '',
    status: row.Status || '',
    slotTime: row['Slot time'] || '',
    slotDuration: toNumber(row['Slot duration'] || ''),
    effectiveDuration: toNumber(row['Effective duration'] || ''),
    studentCount: toNullableNumber(row['Student count'] || ''),
    note: row.Note || '',
    managerNote: row['Manager Note'] || '',
    confirmStatus: row['Confirm Status (OH only)'] || '',
    confirmNote: row['Confirm Note (OH only)'] || '',
  }

  return {
    checkKey: makeCheckCongKey(base),
    ...base,
    salaryAmount: 0,
    salaryRule: '',
    payHours: 0,
  }
}

function parseSlotDate(slotTime: string): Date | null {
  const raw = slotTime.trim()
  const date = new Date(raw)
  if (!Number.isNaN(date.getTime())) return date

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(.+))?$/)
  if (slash) {
    const first = Number(slash[1])
    const second = Number(slash[2])
    const year = Number(slash[3])
    const month = first > 12 ? second : first
    const day = first > 12 ? first : second
    const parsed = new Date(year, month - 1, day)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return Number.isNaN(date.getTime()) ? null : date
}

function sameMonth(record: CheckCongRecord, month: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(month)) return true
  const date = parseSlotDate(record.slotTime)
  if (!date) return false
  const yyyyMm = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}`
  return yyyyMm === month
}

function uniqueMonthKeys(records: CheckCongRecord[]): string[] {
  return Array.from(
    new Set(
      records
        .map((record) => {
          const date = parseSlotDate(record.slotTime)
          if (!date) return ''
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
            2,
            '0',
          )}`
        })
        .filter(Boolean),
    ),
  ).sort((a, b) => b.localeCompare(a))
}

function buildSummary(records: CheckCongRecord[], month: string): CheckCongSummary {
  const checked = records.filter((record) => record.status === 'CHECKED')
  const uncheckedRecords = records.filter((record) => record.status === 'UNCHECKED')
  const classSessions = records.filter((record) => record.type === 'CLASS')
  const officeHours = records.filter((record) => record.type === 'OFFICE_HOURS')
  const totalEffectiveDuration = checked.reduce(
    (sum, record) => sum + record.payHours,
    0,
  )
  const totalSlotDuration = checked.reduce(
    (sum, record) => sum + record.slotDuration,
    0,
  )
  const salaryValues = checked.map((record) => record.salaryAmount)
  const grossEstimatedSalary: number | null = salaryValues.some((value) => value == null)
    ? null
    : salaryValues.reduce<number>((sum, value) => sum + (value ?? 0), 0)
  const salaryTaxAmount =
    grossEstimatedSalary != null && grossEstimatedSalary > 5000000
      ? Math.round(grossEstimatedSalary * 0.1)
      : grossEstimatedSalary == null
        ? null
        : 0
  const estimatedSalary =
    grossEstimatedSalary == null || salaryTaxAmount == null
      ? null
      : grossEstimatedSalary - salaryTaxAmount

  return {
    totalRecords: records.length,
    checkedRecords: checked.length,
    uncheckedRecords: uncheckedRecords.length,
    classSessions: classSessions.length,
    officeHours: officeHours.length,
    totalSlotDuration,
    totalEffectiveDuration,
    estimatedSalary,
    grossEstimatedSalary,
    salaryTaxAmount,
    checkRate: records.length > 0 ? (checked.length / records.length) * 100 : 0,
    monthLabel: /^\d{4}-\d{2}$/.test(month) ? month : 'all',
  }
}

export async function loadCheckCongRecords(): Promise<CheckCongRecord[]> {
  const stat = await fs.stat(CSV_PATH)
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.records

  const csvText = await fs.readFile(CSV_PATH, 'utf8')
  const rows = parseCSVRows(csvText)
  const headers = rows[0] ?? []
  const records = rows
    .slice(1)
    .map((values) => {
      const row: Record<string, string> = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      return rowToRecord(row)
    })
    .filter((record) => record.username || record.workEmail || record.personalEmail)

  cached = { loadedAt: Date.now(), mtimeMs: stat.mtimeMs, records }
  return records
}

export async function saveCheckCongCsv(csvText: string): Promise<{
  savedPath: string
  recordCount: number
}> {
  const rows = parseCSVRows(csvText)
  const headers = rows[0] ?? []
  const requiredHeaders = [
    'Centre shortname',
    'Type',
    'Teacher name',
    'Work email',
    'Username',
    'Status',
    'Slot time',
  ]
  const missingHeaders = requiredHeaders.filter(
    (header) => !headers.includes(header),
  )

  if (missingHeaders.length > 0) {
    throw new Error(`File CSV thiếu cột: ${missingHeaders.join(', ')}`)
  }

  await fs.mkdir(path.dirname(CSV_PATH), { recursive: true })
  await fs.writeFile(CSV_PATH, csvText, 'utf8')
  cached = undefined
  adminBaseCache = undefined

  return {
    savedPath: CSV_PATH,
    recordCount: Math.max(0, rows.length - 1),
  }
}

export async function exportOriginalCheckCongRowsByKeys(
  checkKeys: string[],
): Promise<{ csv: string; count: number }> {
  const keys = new Set(checkKeys.filter(Boolean))
  if (keys.size === 0) return { csv: '', count: 0 }

  const csvText = await fs.readFile(CSV_PATH, 'utf8')
  const rows = parseCSVRows(csvText)
  const headers = rows[0] ?? []
  const matchedRows: string[][] = []

  for (const values of rows.slice(1)) {
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    const record = rowToRecord(row)
    if (keys.has(record.checkKey)) {
      matchedRows.push(headers.map((_, index) => values[index] || ''))
    }
  }

  const csvRows = [headers, ...matchedRows].map((row) =>
    row
      .map((value) => {
        const text = String(value ?? '')
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
      })
      .join(','),
  )

  const csv = csvRows.join('\r\n')
  return { csv: csv ? `\uFEFF${csv}` : csv, count: matchedRows.length }
}

function matchesAdminQuery(record: CheckCongRecord, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return true

  const className = String(record.className ?? '').trim()
  const sessionTitle =
    className && !['undefined', 'null'].includes(className.toLowerCase())
      ? className
      : record.type === 'OFFICE_HOURS'
        ? 'trực trải nghiệm ca trực trải nghiệm'
        : ''

  return [
    sessionTitle,
    record.teacherName,
    record.username,
    record.workEmail,
    record.personalEmail,
    record.centre,
    record.className,
    record.course,
    record.courseLine,
    record.roleType,
    record.type,
  ]
    .map(normalizeSearchText)
    .join(' ')
    .includes(normalizedQuery)
}

function buildAdminMonthBase(
  allRecords: CheckCongRecord[],
  month: string,
): AdminMonthBase {
  const scoped = allRecords
    .filter((record) => sameMonth(record, month))
    .sort((a, b) => {
      const dateA = parseSlotDate(a.slotTime)?.getTime() ?? 0
      const dateB = parseSlotDate(b.slotTime)?.getTime() ?? 0
      return dateB - dateA
    })

  const teacherMap = new Map<
    string,
    {
      teacherName: string
      username: string
      workEmail: string
      checkedRecords: number
      totalRecords: number
      centres: Set<string>
    }
  >()

  for (const record of scoped) {
    const key =
      normalize(record.username) ||
      normalize(record.workEmail) ||
      normalize(record.teacherName)
    if (!key) continue

    const current =
      teacherMap.get(key) ||
      {
        teacherName: record.teacherName,
        username: record.username,
        workEmail: record.workEmail,
        checkedRecords: 0,
        totalRecords: 0,
        centres: new Set<string>(),
      }

    current.totalRecords += 1
    if (record.status === 'CHECKED') current.checkedRecords += 1
    if (record.centre) current.centres.add(record.centre)
    teacherMap.set(key, current)
  }

  const teacherRanking = Array.from(teacherMap.values())
    .map((teacher) => ({
      teacherName: teacher.teacherName,
      username: teacher.username,
      workEmail: teacher.workEmail,
      checkedRecords: teacher.checkedRecords,
      totalRecords: teacher.totalRecords,
      centres: Array.from(teacher.centres).sort(),
    }))
    .sort((a, b) => {
      if (b.checkedRecords !== a.checkedRecords) {
        return b.checkedRecords - a.checkedRecords
      }
      return a.teacherName.localeCompare(b.teacherName, 'vi')
    })

  const checkedByType = scoped.reduce<Record<string, number>>((acc, record) => {
    if (record.status !== 'CHECKED') return acc
    const key = record.type || 'UNKNOWN'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return {
    scoped,
    summary: buildSummary(scoped, month),
    analytics: {
      teacherCount: teacherMap.size,
      checkedByType,
      teacherRanking,
      topTeachers: teacherRanking.slice(0, 10),
      monthLabel: /^\d{4}-\d{2}$/.test(month) ? month : 'all',
    },
  }
}

export async function getAdminCheckCong(input: {
  month?: string
  page?: number
  limit?: number
  status?: string
  query?: string
}) {
  const month = input.month || 'all'
  const page = Math.max(1, Math.floor(input.page || 1))
  const limit = Math.min(100, Math.max(1, Math.floor(input.limit || 20)))
  const status = normalize(input.status)
  const query = input.query || ''
  const allRecords = await loadCheckCongRecords()
  const mtimeMs = cached?.mtimeMs ?? 0
  if (!adminBaseCache || adminBaseCache.mtimeMs !== mtimeMs) {
    adminBaseCache = {
      mtimeMs,
      months: uniqueMonthKeys(allRecords),
      byMonth: new Map(),
    }
  }
  let base = adminBaseCache.byMonth.get(month)
  if (!base) {
    base = buildAdminMonthBase(allRecords, month)
    adminBaseCache.byMonth.set(month, base)
  }

  const filtered = base.scoped.filter((record) => {
    if (status && status !== 'all' && normalize(record.status) !== status) {
      return false
    }
    return matchesAdminQuery(record, query)
  })
  const offset = (page - 1) * limit
  const paginatedRecords = filtered.slice(offset, offset + limit)

  return {
    summary: base.summary,
    records: paginatedRecords,
    totalAvailableRecords: allRecords.length,
    availableMonths: adminBaseCache.months,
    pagination: {
      page,
      limit,
      totalRecords: filtered.length,
      returnedRecords: paginatedRecords.length,
      hasMore: offset + paginatedRecords.length < filtered.length,
    },
    analytics: base.analytics,
  }
}

export async function getTeacherCheckCong(input: {
  email: string
  personalEmail?: string
  username?: string
  code?: string
  month?: string
  hourlyRate?: number | null
}) {
  const records = await loadCheckCongRecords()
  const lookup = new Set(
    [input.email, input.personalEmail, input.username, input.code]
      .map(normalize)
      .filter(Boolean),
  )

  const teacherRecords = records.filter((record) => {
    const candidates = [
      record.workEmail,
      record.personalEmail,
      record.username,
      record.username ? `${record.username}@mindx.net.vn` : '',
    ].map(normalize)
    return candidates.some((candidate) => lookup.has(candidate))
  })

  const month = input.month || 'all'
  const scoped = teacherRecords
    .filter((record) => sameMonth(record, month))
    .map((record) => ({
      ...record,
      ...calculateSalary(record, input.hourlyRate ?? null),
    }))
    .sort((a, b) => {
      const dateA = parseSlotDate(a.slotTime)?.getTime() ?? 0
      const dateB = parseSlotDate(b.slotTime)?.getTime() ?? 0
      return dateB - dateA
    })

  return {
    summary: buildSummary(scoped, month),
    records: scoped,
    totalMatchedRecords: teacherRecords.length,
  }
}
