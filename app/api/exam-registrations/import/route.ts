import { insertExamRegistration } from "@/lib/exam-registration-insert";
import {
  normalizeImportRow,
  rowToRegistrationPayload,
} from "@/lib/csv-registration-import";
import pool from "@/lib/db";
import { requireBearerAdminOrSuperMutation } from "@/lib/auth-server";
import type { Pool } from "pg";
import { NextRequest, NextResponse } from "next/server";

type RowResult =
  | { line: number; ok: true; id: unknown }
  | { line: number; ok: false; error: string; result_id?: number };

/** Song song má»™t sá»‘ dÃ²ng â€” tÄƒng tá»‘c khi DB_POOL_MAX > 1 (pool size 1 váº«n an toÃ n, chá»‰ xáº¿p hÃ ng). */
function importConcurrency(): number {
  const n = parseInt(process.env.IMPORT_ROW_CONCURRENCY || "4", 10);
  return Math.max(1, Math.min(16, n));
}

async function processOneRow(
  pool: Pool,
  row: unknown,
  line: number
): Promise<RowResult> {
  if (!row || typeof row !== "object") {
    return { line, ok: false, error: "DÃ²ng khÃ´ng há»£p lá»‡" };
  }
  const normalized = normalizeImportRow(row as Record<string, string>);
  const payload = rowToRegistrationPayload(normalized);
  if (!payload.ma_giao_vien && !payload.teacher_code) {
    return { line, ok: false, error: "Thiáº¿u MÃ£ GV (ma_giao_vien)" };
  }

  const res = await insertExamRegistration(pool, payload);
  if (res.ok) {
    return { line, ok: true, id: res.data.id };
  }
  return {
    line,
    ok: false,
    error: res.error,
    ...(res.result_id != null ? { result_id: res.result_id } : {}),
  };
}

/** Cháº¡y tá»‘i Ä‘a `concurrency` tÃ¡c vá»¥ insert cÃ¹ng lÃºc (theo chá»— trá»‘ng trong pool). */
async function runRowsWithConcurrency(
  pool: Pool,
  rawRows: unknown[],
  lineStart: number,
  concurrency: number
): Promise<RowResult[]> {
  const n = rawRows.length;
  const results: RowResult[] = new Array(n);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= n) return;
      const line = lineStart + i;
      results[i] = await processOneRow(pool, rawRows[i], line);
    }
  }

  const workers = Math.min(concurrency, n);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

/**
 * POST JSON: { rows: Record<string, string>[], lineStart?: number }
 * â€” má»—i row giá»‘ng body POST /api/exam-registrations (sau khi map header CSV).
 * lineStart: sá»‘ dÃ²ng trÃªn file cá»§a pháº§n tá»­ Ä‘áº§u tiÃªn trong `rows` (máº·c Ä‘á»‹nh 2 = dÃ²ng dá»¯ liá»‡u Ä‘áº§u sau header).
 */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const authGate = await requireBearerAdminOrSuperMutation(request);
    if (!authGate.ok) return authGate.response;

    const body = await request.json();
    const rawRows = body?.rows;
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Cáº§n máº£ng rows (Ã­t nháº¥t 1 dÃ²ng)." },
        { status: 400 }
      );
    }

    const lineStartRaw = body?.lineStart;
    const lineStart =
      typeof lineStartRaw === "number" && Number.isFinite(lineStartRaw) && lineStartRaw >= 1
        ? Math.floor(lineStartRaw)
        : 2;

    const results = await runRowsWithConcurrency(pool, rawRows, lineStart, importConcurrency());
    const imported = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);
    return NextResponse.json({
      success: true,
      imported,
      total: rawRows.length,
      failedCount: failed.length,
      results,
    });
  } catch (e) {
    console.error("exam-registrations/import:", e);
    return NextResponse.json({ success: false, error: "KhÃ´ng xá»­ lÃ½ Ä‘Æ°á»£c yÃªu cáº§u import" }, { status: 400 });
  }
}
