const DEFAULT_SHEET_ID = '1Z2oKAv9ivevDuNhIFxYjKjzuwERaCg-OUSkDZkNf030';
const DEFAULT_GID = '897116356';
const DEFAULT_CACHE_TTL_MS = 2 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface CacheStore {
  entry: CacheEntry<PedagogyTrainingSheetData> | null;
  pending: Promise<PedagogyTrainingSheetData> | null;
}

export interface PedagogyTrainingRow {
  rowNumber: number;
  key: string;
  fullName: string;
  code: string;
  userName: string;
  center: string;
  teacherStatus: string;
  block: string;
  lesson1: string;
  lesson2: string;
  lesson3: string;
  lesson4: string;
  reviewScore70: string;
  theoryScore30: string;
  totalScore: string;
  totalLesson: string;
  trainingStatus: string;
  raw: Record<string, string>;
}

export interface PedagogyLessonStat {
  key: string;
  label: string;
  completed: number;
  total: number;
  rate: number;
  averageScore: number | null;
}

export interface PedagogyTrainingSummary {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  completionRate: number;
  averageScore: number | null;
  byGen: Record<string, number>;
  byRegion: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface PedagogyTrainingSheetData {
  source: {
    sheetId: string;
    gid: string;
    csvUrl: string;
    viewUrl: string;
  };
  headers: string[];
  lessonHeaders: string[];
  fetchedAt: string;
  rows: PedagogyTrainingRow[];
  summary: PedagogyTrainingSummary;
  lessonStats: PedagogyLessonStat[];
}

const globalForCache = global as unknown as {
  pedagogyTrainingSheetCache?: CacheStore;
};

const cacheStore: CacheStore = globalForCache.pedagogyTrainingSheetCache || {
  entry: null,
  pending: null,
};
globalForCache.pedagogyTrainingSheetCache = cacheStore;

function getCacheTtlMs() {
  const configured = Number(process.env.PEDAGOGY_TRAINING_CACHE_TTL_MS || DEFAULT_CACHE_TTL_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_CACHE_TTL_MS;
}

function isCacheValid(entry: CacheEntry<PedagogyTrainingSheetData> | null) {
  return Boolean(entry && Date.now() - entry.timestamp < getCacheTtlMs());
}

function cleanCell(value: string | undefined) {
  return (value || '').replace(/\r/g, '').trim();
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseCsv(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  const text = csvText.replace(/\uFEFF/g, '');

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      currentRow.push(cleanCell(currentCell));
      currentCell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      currentRow.push(cleanCell(currentCell));
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      continue;
    }
    currentCell += char;
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(cleanCell(currentCell));
    rows.push(currentRow);
  }

  return rows;
}

function pickColumnIndex(normalizedHeaders: string[], aliases: string[]) {
  return normalizedHeaders.findIndex((header) =>
    aliases.some((alias) => header === alias || header.includes(alias)),
  );
}

function findHeaderRow(rows: string[][]) {
  let bestRow = 0;
  let bestScore = -1;
  const maxRows = Math.min(rows.length, 10);

  for (let i = 0; i < maxRows; i++) {
    const normalized = rows[i].map((cell) => normalizeText(cell));
    const hasName = normalized.some((cell) => cell.includes('full name') || cell.includes('ho ten') || cell.includes('name') || cell.includes('giao vien') || cell.includes('ung vien'));
    const hasCode = normalized.some((cell) => cell === 'code' || cell.includes('ma giao vien') || cell.includes('ma ung vien'));
    const hasTraining = normalized.some((cell) => cell.includes('lesson') || cell.includes('bai') || cell.includes('diem') || cell.includes('tap huan'));
    const score = [hasName, hasCode, hasTraining].filter(Boolean).length;
    if (score > bestScore) {
      bestScore = score;
      bestRow = i;
    }
  }

  return bestRow;
}

function detectHeaderDepth(rows: string[][], headerRowIndex: number) {
  let depth = 1;
  for (let offset = 1; offset <= 2; offset++) {
    const row = rows[headerRowIndex + offset];
    if (!row) break;
    const normalized = row.map((cell) => normalizeText(cell));
    const hasHeaderLikeCell = normalized.some((cell) =>
      Boolean(cell) &&
      (cell.includes('lesson') ||
        cell.includes('diem') ||
        cell.includes('total') ||
        cell.includes('status') ||
        cell.includes('ly thuyet') ||
        cell.includes('duyet giang')),
    );
    if (hasHeaderLikeCell) depth = offset + 1;
  }
  return depth;
}

function buildHeadersFromRows(rows: string[][], headerRowIndex: number, depth: number) {
  const headerRows = rows.slice(headerRowIndex, headerRowIndex + depth);
  const maxCols = Math.max(...headerRows.map((row) => row.length));

  return Array.from({ length: maxCols }, (_, index) => {
    const parts = headerRows
      .map((row) => cleanCell(row[index]))
      .filter(Boolean)
      .filter((part) => normalizeText(part) !== 'tap huan su pham');
    const uniqueParts = parts.filter((part, partIndex) => parts.findIndex((item) => normalizeText(item) === normalizeText(part)) === partIndex);
    return uniqueParts[uniqueParts.length - 1] || `Column ${index + 1}`;
  });
}

function getSheetSource() {
  const sheetId = process.env.PEDAGOGY_TRAINING_SHEET_ID?.trim() || DEFAULT_SHEET_ID;
  const gid = process.env.PEDAGOGY_TRAINING_SHEET_GID?.trim() || DEFAULT_GID;
  const csvUrl =
    process.env.PEDAGOGY_TRAINING_SHEET_CSV_URL?.trim() ||
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

  return {
    sheetId,
    gid,
    csvUrl,
    viewUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit?gid=${gid}#gid=${gid}`,
  };
}

function inferStatus(row: PedagogyTrainingRow) {
  const explicit = normalizeText(row.trainingStatus);
  if (explicit) return row.trainingStatus;
  return 'Chưa bắt đầu';
}

function buildSummary(rows: PedagogyTrainingRow[]): PedagogyTrainingSummary {
  const summary: PedagogyTrainingSummary = {
    total: rows.length,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    completionRate: 0,
    averageScore: null,
    byGen: {},
    byRegion: {},
    byStatus: {},
  };

  for (const row of rows) {
    const status = inferStatus(row);
    const normalizedStatus = normalizeText(status);
    if (normalizedStatus.includes('hoan thanh') || normalizedStatus.includes('completed') || normalizedStatus.includes('done')) summary.completed++;
    else if (normalizedStatus.includes('dang') || normalizedStatus.includes('progress')) summary.inProgress++;
    else summary.notStarted++;

    const gen = row.center || 'Chưa rõ cơ sở';
    const region = row.block || 'Chưa rõ khối';
    const statusLabel = status || 'Chưa rõ';
    summary.byGen[gen] = (summary.byGen[gen] || 0) + 1;
    summary.byRegion[region] = (summary.byRegion[region] || 0) + 1;
    summary.byStatus[statusLabel] = (summary.byStatus[statusLabel] || 0) + 1;
  }

  summary.completionRate = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
  summary.averageScore = null;
  return summary;
}

function buildLessonStats(rows: PedagogyTrainingRow[], lessonHeaders: string[]): PedagogyLessonStat[] {
  return lessonHeaders.map((header) => {
    let completed = 0;

    for (const row of rows) {
      if (cleanCell(row.raw[header])) completed++;
    }

    return {
      key: header,
      label: header,
      completed,
      total: rows.length,
      rate: rows.length > 0 ? Math.round((completed / rows.length) * 100) : 0,
      averageScore: null,
    };
  });
}

function parseSheetCsv(csvText: string): PedagogyTrainingSheetData {
  const source = getSheetSource();
  const rows = parseCsv(csvText).filter((cells) => cells.some((cell) => cell.trim()));
  if (rows.length === 0) {
    return {
      source,
      headers: [],
      lessonHeaders: [],
      fetchedAt: new Date().toISOString(),
      rows: [],
      summary: buildSummary([]),
      lessonStats: [],
    };
  }

  const headerRowIndex = findHeaderRow(rows);
  const headerDepth = detectHeaderDepth(rows, headerRowIndex);
  const headers = buildHeadersFromRows(rows, headerRowIndex, headerDepth);
  const normalizedHeaders = headers.map((header) => normalizeText(header));

  const nameIndex = pickColumnIndex(normalizedHeaders, ['full name', 'ho va ten', 'ho ten', 'ten giao vien']);
  const codeIndex = pickColumnIndex(normalizedHeaders, ['code', 'ma giao vien', 'ma ung vien']);
  const userNameIndex = pickColumnIndex(normalizedHeaders, ['user name', 'username', 'ten dang nhap']);
  const centerIndex = pickColumnIndex(normalizedHeaders, ['co so', 'main centre', 'center', 'campus']);
  const teacherStatusIndex = pickColumnIndex(normalizedHeaders, ['status', 'trang thai']);
  const blockIndex = pickColumnIndex(normalizedHeaders, ['khoi', 'course line', 'block']);
  const lesson1Index = pickColumnIndex(normalizedHeaders, ['lesson 1']);
  const lesson2Index = pickColumnIndex(normalizedHeaders, ['lesson 2']);
  const lesson3Index = pickColumnIndex(normalizedHeaders, ['lesson 3']);
  const lesson4Index = pickColumnIndex(normalizedHeaders, ['lesson 4']);
  const reviewScoreIndex = pickColumnIndex(normalizedHeaders, ['diem duyet giang 70', 'duyet giang 70']);
  const theoryScoreIndex = pickColumnIndex(normalizedHeaders, ['diem ly thuyet 30', 'ly thuyet 30']);
  const totalScoreIndex = pickColumnIndex(normalizedHeaders, ['total score']);
  const totalLessonIndex = pickColumnIndex(normalizedHeaders, ['total lesson']);
  const statusIndexes = normalizedHeaders
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => header === 'status')
    .map(({ index }) => index);
  const trainingStatusIndex = statusIndexes.length > 1 ? statusIndexes[statusIndexes.length - 1] : -1;
  const lessonIndexes = [lesson1Index, lesson2Index, lesson3Index, lesson4Index].filter((index) => index >= 0);
  const lessonHeaders = lessonIndexes.map((index) => headers[index]);

  const parsedRows: PedagogyTrainingRow[] = [];
  for (let i = headerRowIndex + headerDepth; i < rows.length; i++) {
    const row = rows[i];
    const nonEmptyCells = row.filter((cell) => cell.trim()).length;
    if (nonEmptyCells === 0) continue;

    const raw: Record<string, string> = {};
    headers.forEach((header, index) => {
      raw[header] = cleanCell(row[index]);
    });

    const item: PedagogyTrainingRow = {
      rowNumber: i + 1,
      key: `${cleanCell(row[codeIndex]) || cleanCell(row[userNameIndex]) || cleanCell(row[nameIndex]) || i}`,
      fullName: nameIndex >= 0 ? cleanCell(row[nameIndex]) : '',
      code: codeIndex >= 0 ? cleanCell(row[codeIndex]) : '',
      userName: userNameIndex >= 0 ? cleanCell(row[userNameIndex]) : '',
      center: centerIndex >= 0 ? cleanCell(row[centerIndex]) : '',
      teacherStatus: teacherStatusIndex >= 0 ? cleanCell(row[teacherStatusIndex]) : '',
      block: blockIndex >= 0 ? cleanCell(row[blockIndex]) : '',
      lesson1: lesson1Index >= 0 ? cleanCell(row[lesson1Index]) : '',
      lesson2: lesson2Index >= 0 ? cleanCell(row[lesson2Index]) : '',
      lesson3: lesson3Index >= 0 ? cleanCell(row[lesson3Index]) : '',
      lesson4: lesson4Index >= 0 ? cleanCell(row[lesson4Index]) : '',
      reviewScore70: reviewScoreIndex >= 0 ? cleanCell(row[reviewScoreIndex]) : '',
      theoryScore30: theoryScoreIndex >= 0 ? cleanCell(row[theoryScoreIndex]) : '',
      totalScore: totalScoreIndex >= 0 ? cleanCell(row[totalScoreIndex]) : '',
      totalLesson: totalLessonIndex >= 0 ? cleanCell(row[totalLessonIndex]) : '',
      trainingStatus: trainingStatusIndex >= 0 ? cleanCell(row[trainingStatusIndex]) : '',
      raw,
    };

    if (!item.fullName && !item.code && !item.userName && nonEmptyCells < 2) continue;
    item.trainingStatus = inferStatus(item);
    parsedRows.push(item);
  }

  return {
    source,
    headers,
    lessonHeaders,
    fetchedAt: new Date().toISOString(),
    rows: parsedRows,
    summary: buildSummary(parsedRows),
    lessonStats: buildLessonStats(parsedRows, lessonHeaders),
  };
}

async function fetchAndParseSheet() {
  const source = getSheetSource();
  const response = await fetch(source.csvUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Không thể đọc sheet Tập huấn sư phạm (HTTP ${response.status}). Vui lòng chia sẻ sheet ở chế độ public CSV hoặc cấu hình PEDAGOGY_TRAINING_SHEET_CSV_URL hợp lệ.`);
  }

  const csvText = await response.text();
  if (/ServiceLogin/i.test(csvText) || /accounts\.google\.com/i.test(csvText) || /<html/i.test(csvText)) {
    throw new Error('Sheet Tập huấn sư phạm chưa public CSV. Vui lòng bật quyền đọc hoặc publish sheet để hệ thống đồng bộ.');
  }

  return parseSheetCsv(csvText);
}

export async function getPedagogyTrainingSheetData(forceRefresh = false) {
  if (!forceRefresh && isCacheValid(cacheStore.entry)) return cacheStore.entry!.data;
  if (!forceRefresh && cacheStore.pending) return cacheStore.pending;

  cacheStore.pending = (async () => {
    const data = await fetchAndParseSheet();
    cacheStore.entry = { data, timestamp: Date.now() };
    return data;
  })();

  try {
    return await cacheStore.pending;
  } catch (error) {
    if (cacheStore.entry) return cacheStore.entry.data;
    throw error;
  } finally {
    cacheStore.pending = null;
  }
}
