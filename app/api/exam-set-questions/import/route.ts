import pool from '@/lib/db';
import { requireBearerAdminOrSuperMutation } from '@/lib/auth-server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const authGate = await requireBearerAdminOrSuperMutation(request);
    if (!authGate.ok) return authGate.response;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const setId = formData.get('set_id') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'KhÃ´ng tÃ¬m tháº¥y file' },
        { status: 400 }
      );
    }

    if (!setId) {
      return NextResponse.json(
        { success: false, error: 'Thiáº¿u set_id' },
        { status: 400 }
      );
    }

    const text = await file.text();
    // Split by any newline sequence (\n, \r\n, \r) and filter out empty lines
    const lines = text.split(/\r?\n/).filter((line) => line.trim());

    console.log(`[Import] Total lines found: ${lines.length}`);

    if (lines.length < 2) {
      return NextResponse.json(
        { success: false, error: 'File CSV rá»—ng hoáº·c khÃ´ng há»£p lá»‡' },
        { status: 400 }
      );
    }

    // Detect delimiter from the first line (tab or comma)
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    console.log(`[Import] Detected delimiter: ${delimiter === '\t' ? 'Tab' : 'Comma'}`);

    const headers = parseCSVLine(lines[0], delimiter).map(h => h.trim());
    console.log(`[Import] Parsed headers:`, headers);
    const expectedHeaders = [
      'question_text',
      'question_type',
      'correct_answer',
      'options',
      'points',
      'difficulty',
      'explanation',
      'image_url',
    ];

    const hasAllHeaders = expectedHeaders.every((h) => headers.includes(h));
    if (!hasAllHeaders) {
      const missing = expectedHeaders.filter(h => !headers.includes(h));
      console.error(`[Import] Missing headers: ${missing.join(', ')}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Header khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng. Vui lÃ²ng sá»­ dá»¥ng file máº«u.',
          expected: expectedHeaders,
          received: headers,
        },
        { status: 400 }
      );
    }

    const maxOrderResult = await pool.query(
      'SELECT COALESCE(MAX(thu_tu_hien_thi), 0) as max_order FROM chuyen_sau_bode_cauhoi WHERE id_de = $1',
      [setId]
    );
    let currentOrder = Number(maxOrderResult.rows[0]?.max_order || 0);

    const errors: string[] = [];
    const imported: Array<{ id: number; question_text: string; line: number }> = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i], delimiter);
        if (values.length === 0 || values.every((v) => !v.trim())) {
          continue;
        }

        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        const normalizedQuestionText = row.question_text?.trim() || '[Tam] Chua dan noi dung tu doc';

        if (!row.question_type?.trim()) {
          const msg = `DÃ²ng ${i + 1}: Thiáº¿u loáº¡i cÃ¢u há»i`;
          console.warn(`[Import] ${msg}`);
          errors.push(msg);
          continue;
        }

        const validTypes = ['multiple_choice', 'true_false', 'short_answer', 'essay'];
        if (!validTypes.includes(row.question_type)) {
          const msg = `DÃ²ng ${i + 1}: Loáº¡i cÃ¢u há»i khÃ´ng há»£p lá»‡ (${row.question_type})`;
          console.warn(`[Import] ${msg}`);
          errors.push(msg);
          continue;
        }

        let optionsArray: string[] | null = null;
        if (row.options?.trim()) {
          optionsArray = row.options
            .split('|')
            .map((opt) => opt.trim())
            .filter(Boolean);
        }

        if (row.question_type === 'multiple_choice' || row.question_type === 'true_false') {
          if (!optionsArray || optionsArray.length < 2) {
            errors.push(`DÃ²ng ${i + 1}: CÃ¢u há»i ${row.question_type} cáº§n Ã­t nháº¥t 2 Ä‘Ã¡p Ã¡n`);
            continue;
          }
          if (!row.correct_answer?.trim()) {
            const msg = `DÃ²ng ${i + 1}: Thiáº¿u Ä‘Ã¡p Ã¡n Ä‘Ãºng (cá»™t correct_answer trá»‘ng)`;
            console.warn(`[Import] ${msg}`);
            errors.push(msg);
            continue;
          }
          if (!optionsArray.includes(row.correct_answer.trim())) {
            const msg = `DÃ²ng ${i + 1}: ÄÃ¡p Ã¡n Ä‘Ãºng "${row.correct_answer.trim()}" khÃ´ng cÃ³ trong danh sÃ¡ch Ä‘Ã¡p Ã¡n [${optionsArray.join(', ')}]`;
            console.warn(`[Import] ${msg}`);
            errors.push(msg);
            continue;
          }
        }

        const points = parseFloat(row.points || '1');
        if (Number.isNaN(points) || points < 0) {
          errors.push(`DÃ²ng ${i + 1}: Äiá»ƒm sá»‘ khÃ´ng há»£p lá»‡`);
          continue;
        }

        currentOrder++;
        const insertQuestion = await pool.query(
          `INSERT INTO chuyen_sau_cauhoi
          (loai_cau_hoi, noi_dung_cau_hoi, lua_chon_a, lua_chon_b, lua_chon_c, lua_chon_d, dap_an_dung, image_url, giai_thich, diem, do_kho, tao_luc)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          RETURNING id`,
          [
            row.question_type === 'essay' ? 'tu_luan' : row.question_type,
            normalizedQuestionText,
            optionsArray?.[0] || null,
            optionsArray?.[1] || null,
            optionsArray?.[2] || null,
            optionsArray?.[3] || null,
            row.correct_answer?.trim() || '',
            row.image_url?.trim() || null,
            row.explanation?.trim() || null,
            points,
            ['easy', 'medium', 'hard'].includes((row.difficulty || '').trim()) ? row.difficulty.trim() : 'medium',
          ]
        );

        await pool.query(
          `INSERT INTO chuyen_sau_bode_cauhoi (id_de, id_cau, thu_tu_hien_thi, tao_luc)
           VALUES ($1, $2, $3, NOW())`,
          [setId, insertQuestion.rows[0].id, currentOrder]
        );

        imported.push({
          id: insertQuestion.rows[0].id,
          question_text: normalizedQuestionText,
          line: i + 1,
        });
      } catch (error: any) {
        console.error(`Error parsing line ${i + 1}:`, error);
        errors.push(`DÃ²ng ${i + 1}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import thÃ nh cÃ´ng ${imported.length} cÃ¢u há»i`,
      imported: imported.length,
      errors: errors.length > 0 ? errors : undefined,
      data: imported,
    });
  } catch (error: any) {
    console.error('Error importing exam set questions:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Lá»—i khi import cÃ¢u há»i' },
      { status: 500 }
    );
  }
}

function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
