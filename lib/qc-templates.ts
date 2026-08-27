import 'server-only'

export const QC_SHEET_ID = '1FhNjipJTq6Dz_t1S9mkil5zbadqHCdjUySkfysuIyqY'
export const QC_SHEET_URL = `https://docs.google.com/spreadsheets/d/${QC_SHEET_ID}/export?format=xlsx`

export type QCRawCriterion = {
  id: string
  category: string
  criterion: string
  guide: string
  maxScore: number
  selectionMode: QCSelectionMode
}

export type QCSelectionMode = 'multiple' | 'single'

export type QCCriterionGroup = {
  id: string
  category: string
  criterion: string
  selectionMode: QCSelectionMode
  maxScore: number
  options: Array<{
    id: string
    guide: string
    score: number
  }>
}

export type QCTemplate = {
  key: string
  title: string
  sheetName: string
  sheetColumnOffset: number
  maxScore: number
  criteria: QCCriterionGroup[]
}

type SheetConfig = {
  sheetName: string
  key: string
  title: string
  offset: number
}

const TEMPLATE_CONFIGS: SheetConfig[] = [
  { sheetName: 'QC khai giảng', key: 'opening', title: 'QC buổi khai giảng', offset: 0 },
  { sheetName: 'QC buổi thường', key: 'regular', title: 'QC buổi thường', offset: 0 },
  { sheetName: 'QC CheckpointNXCK', key: 'checkpoint', title: 'QC Checkpoint', offset: 0 },
  { sheetName: 'QC CheckpointNXCK', key: 'final-comment', title: 'QC Nhận xét cuối khóa', offset: 8 },
  { sheetName: 'QC SPCK', key: 'final-project', title: 'QC Sản phẩm cuối khóa', offset: 0 },
  { sheetName: 'QC Demo', key: 'demo', title: 'QC Demo', offset: 0 },
]

let cachedTemplates:
  | {
      fetchedAt: number
      templates: QCTemplate[]
    }
  | null = null

const TEMPLATE_CACHE_MS = 30 * 60_000

function normalizeTextCell(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim()
}

function normalizeInline(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function parseScore(value: unknown): number | null {
  const parsed = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function slugify(input: string): string {
  const ascii = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return ascii || 'item'
}

function rowCell(row: unknown[], index: number): string {
  return normalizeTextCell(row[index])
}

function columnName(index: number): string {
  let name = ''
  let current = index + 1
  while (current > 0) {
    const remainder = (current - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    current = Math.floor((current - 1) / 26)
  }
  return name
}

function cellRef(rowIndex: number, columnIndex: number) {
  return `${columnName(columnIndex)}${rowIndex + 1}`
}

function cellFillRgb(sheet: Record<string, any>, rowIndex: number, columnIndex: number) {
  const cell = sheet[cellRef(rowIndex, columnIndex)]
  const rgb = cell?.s?.fgColor?.rgb ?? cell?.s?.bgColor?.rgb ?? ''
  return String(rgb).toUpperCase().replace(/^FF/, '')
}

function selectionModeFromRgb(rgb: string): QCSelectionMode | null {
  if (rgb === 'C9DAF8') return 'multiple'
  if (rgb === 'D9EAD3') return 'single'
  return null
}

function readRowSelectionMode(
  sheet: Record<string, any>,
  rowIndex: number,
  offset: number,
): QCSelectionMode | null {
  const guideMode = selectionModeFromRgb(cellFillRgb(sheet, rowIndex, offset + 2))
  if (guideMode) return guideMode

  const criterionMode = selectionModeFromRgb(cellFillRgb(sheet, rowIndex, offset + 1))
  if (criterionMode) return criterionMode

  return selectionModeFromRgb(cellFillRgb(sheet, rowIndex, offset + 3))
}

function isIgnorableRow(category: string, criterion: string, guide: string, score: number | null) {
  const marker = normalizeInline([category, criterion, guide].filter(Boolean).join(' '))
  if (!marker && score == null) return true
  if (/^(gv|ta)\s*:/i.test(marker)) return true
  if (/^tổng điểm$/i.test(marker)) return true
  if (/^xếp loại/i.test(marker)) return true
  return false
}

function groupCriteria(templateKey: string, rows: QCRawCriterion[]): QCCriterionGroup[] {
  const groups: QCCriterionGroup[] = []
  const groupIndex = new Map<string, QCCriterionGroup>()

  rows.forEach((row, index) => {
    const groupKey = `${row.category}__${row.criterion}`
    let group = groupIndex.get(groupKey)
    if (!group) {
      group = {
        id: `${templateKey}-${slugify(row.category)}-${slugify(row.criterion)}`,
        category: row.category,
        criterion: row.criterion,
        selectionMode: row.selectionMode,
        maxScore: 0,
        options: [],
      }
      groups.push(group)
      groupIndex.set(groupKey, group)
    }
    if (row.selectionMode === 'multiple') {
      group.selectionMode = 'multiple'
    }
    group.options.push({
      id: `${group.id}-${index + 1}`,
      guide: row.guide,
      score: row.maxScore,
    })
  })

  groups.forEach((group) => {
    group.maxScore =
      group.selectionMode === 'multiple'
        ? group.options.reduce((sum, option) => sum + Math.max(0, option.score), 0)
        : Math.max(0, ...group.options.map((option) => option.score))
  })

  return groups
}

function parseTemplateRows(
  rows: unknown[][],
  sheet: Record<string, any>,
  config: SheetConfig,
): QCRawCriterion[] {
  const headerIndex = rows.findIndex((row) => {
    return (
      rowCell(row, config.offset) === 'Lĩnh vực' &&
      rowCell(row, config.offset + 1) === 'Tiêu chí'
    )
  })

  if (headerIndex < 0) return []

  let currentCategory = ''
  let currentCriterion = ''
  let currentSelectionMode: QCSelectionMode = 'single'
  const criteria: QCRawCriterion[] = []

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    const categoryCell = normalizeInline(rowCell(row, config.offset))
    const criterionCell = normalizeInline(rowCell(row, config.offset + 1))
    const guide = rowCell(row, config.offset + 2)
    const score = parseScore(row[config.offset + 3])

    if (categoryCell) currentCategory = categoryCell
    if (criterionCell) currentCriterion = criterionCell
    const rowSelectionMode = readRowSelectionMode(sheet, rowIndex, config.offset)
    if (criterionCell && rowSelectionMode) {
      currentSelectionMode = rowSelectionMode
    } else if (rowSelectionMode && currentSelectionMode !== rowSelectionMode) {
      currentSelectionMode = rowSelectionMode
    }

    if (isIgnorableRow(currentCategory, currentCriterion, guide, score)) {
      continue
    }

    if (!currentCategory || !currentCriterion || !guide) continue

    criteria.push({
      id: `${config.key}-${criteria.length + 1}`,
      category: currentCategory,
      criterion: currentCriterion,
      guide,
      maxScore: score ?? 0,
      selectionMode: currentSelectionMode,
    })
  }

  return criteria
}

export async function fetchQCTemplates(forceRefresh = false): Promise<QCTemplate[]> {
  const now = Date.now()
  if (
    !forceRefresh &&
    cachedTemplates &&
    now - cachedTemplates.fetchedAt < TEMPLATE_CACHE_MS
  ) {
    return cachedTemplates.templates
  }

  const response = await fetch(QC_SHEET_URL, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Không thể tải Google Sheet QC (${response.status})`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const xlsx = await import('xlsx')
  const workbook = xlsx.read(buffer, { type: 'buffer', cellStyles: true })

  const templates = TEMPLATE_CONFIGS.map((config) => {
    const sheet = workbook.Sheets[config.sheetName]
    if (!sheet) {
      return {
        key: config.key,
        title: config.title,
        sheetName: config.sheetName,
        sheetColumnOffset: config.offset,
        maxScore: 0,
        criteria: [],
      }
    }

    const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw: false,
    })
    const criteriaRows = parseTemplateRows(rows, sheet as Record<string, any>, config)
    const criteria = groupCriteria(config.key, criteriaRows)
    const maxScore = criteria.reduce((sum, group) => sum + group.maxScore, 0)

    return {
      key: config.key,
      title: config.title,
      sheetName: config.sheetName,
      sheetColumnOffset: config.offset,
      maxScore,
      criteria,
    }
  }).filter((template) => template.criteria.length > 0)

  cachedTemplates = { fetchedAt: now, templates }
  return templates
}

export function findQCTemplate(templates: QCTemplate[], key: string) {
  return templates.find((template) => template.key === key) ?? null
}
