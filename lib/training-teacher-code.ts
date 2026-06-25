type Queryable = {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: Array<Record<string, unknown>> }>
}

export type TrainingTeacherCodeResolution = {
  canonicalCode: string
  aliases: string[]
}

function normalizeCode(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function uniqCodes(values: unknown[]): string[] {
  const seen = new Set<string>()
  for (const value of values) {
    const normalized = normalizeCode(value)
    if (normalized) seen.add(normalized)
  }
  return [...seen]
}

/**
 * Resolve mã giáo viên cho training.
 *
 * `teachers.code` là canonical key để ghi dữ liệu mới. `user_name` và prefix
 * của `work_email` là alias để đọc dữ liệu cũ, ví dụ:
 * code=manhnd, user_name=threem2502, work_email=threem2502@mindx.net.vn.
 */
export async function resolveTrainingTeacherCode(
  db: Queryable,
  rawCode: unknown,
): Promise<TrainingTeacherCodeResolution> {
  const inputCode = normalizeCode(rawCode)
  if (!inputCode) {
    return { canonicalCode: '', aliases: [] }
  }

  const result = await db.query(
    `SELECT
       LOWER(TRIM(code)) AS canonical_code,
       LOWER(TRIM(COALESCE(NULLIF(user_name, ''), NULLIF("User name", '')))) AS user_name,
       LOWER(TRIM(SPLIT_PART(COALESCE(NULLIF(work_email, ''), NULLIF("Work email", '')), '@', 1))) AS work_email_prefix
     FROM teachers
     WHERE LOWER(TRIM(code)) = $1
        OR LOWER(TRIM(COALESCE(user_name, ''))) = $1
        OR LOWER(TRIM(COALESCE("User name", ''))) = $1
        OR LOWER(TRIM(SPLIT_PART(COALESCE(work_email, ''), '@', 1))) = $1
        OR LOWER(TRIM(SPLIT_PART(COALESCE("Work email", ''), '@', 1))) = $1
     LIMIT 1`,
    [inputCode],
  )

  const row = result.rows[0]
  const canonicalCode = normalizeCode(row?.canonical_code) || inputCode
  const aliases = uniqCodes([
    canonicalCode,
    row?.user_name,
    row?.work_email_prefix,
    inputCode,
  ])

  return { canonicalCode, aliases }
}
