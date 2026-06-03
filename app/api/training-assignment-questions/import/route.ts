import pool from '@/lib/db';
import { requireBearerAdminOrSuperMutation } from '@/lib/auth-server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const authGate = await requireBearerAdminOrSuperMutation(request);
    if (!authGate.ok) return authGate.response;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const assignmentId = formData.get('assignment_id') as string;

    if (!file) {
      return NextResponse.json({ success: false, error: 'KhÃ´ng tÃ¬m tháº¥y file' }, { status: 400 });
    }
    if (!assignmentId) {
      return NextResponse.json({ success: false, error: 'Thiáº¿u assignment_id' }, { status: 400 });
    }

    const text = await file.text();
    // Bá» BOM náº¿u cÃ³
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines = cleanText.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return NextResponse.json({ success: false, error: 'File CSV rá»—ng hoáº·c khÃ´ng há»£p lá»‡' }, { status: 400 });
    }

    const headers = parseCSVLine(lines[0]);
    const expectedHeaders = ['question_text', 'question_type', 'correct_answer', 'options', 'points', 'difficulty', 'explanation', 'image_url'];
    const hasAllHeaders = expectedHeaders.every(h => headers.includes(h));
    if (!hasAllHeaders) {
      return NextResponse.json({
        success: false,
        error: 'Header khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng. Vui lÃ²ng sá»­ dá»¥ng file máº«u.',
        expected: expectedHeaders,
        received: headers
      }, { status: 400 });
    }

    const maxOrderResult = await pool.query(
      'SELECT COALESCE(MAX(order_number), 0) as max_order FROM training_assignment_questions WHERE assignment_id = $1',
      [assignmentId]
    );
    let currentOrder = maxOrderResult.rows[0].max_order;

    const errors: string[] = [];
    const imported: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0 || values.every(v => !v.trim())) continue;

        const row: Record<string, string> = {};
        headers.forEach((header, index) => { row[header] = values[index] || ''; });

        if (!row.question_text?.trim()) {
          errors.push(`DÃ²ng ${i + 1}: Thiáº¿u ná»™i dung cÃ¢u há»i`);
          continue;
        }

        if (!row.question_type?.trim()) {
          errors.push(`DÃ²ng ${i + 1}: Thiáº¿u loáº¡i cÃ¢u há»i`);
          continue;
        }

        const validTypes = ['multiple_choice', 'multiple_select', 'true_false', 'short_answer', 'essay'];
        if (!validTypes.includes(row.question_type)) {
          errors.push(`DÃ²ng ${i + 1}: Loáº¡i cÃ¢u há»i khÃ´ng há»£p lá»‡ (${row.question_type})`);
          continue;
        }

        const validDifficulties = ['easy', 'medium', 'hard'];
        if (row.difficulty && !validDifficulties.includes(row.difficulty)) {
          errors.push(`DÃ²ng ${i + 1}: Äá»™ khÃ³ khÃ´ng há»£p lá»‡ (${row.difficulty})`);
          continue;
        }

        // Parse options (pipe-separated)
        let optionsArray: string[] | null = null;
        if (row.options?.trim()) {
          optionsArray = row.options.split('|').map(o => o.trim()).filter(Boolean);
        }

        // Äiá»ƒm sá»‘ â€” cho phÃ©p 0
        const points = parseFloat(row.points) || 0;
        if (points < 0) {
          errors.push(`DÃ²ng ${i + 1}: Äiá»ƒm sá»‘ khÃ´ng há»£p lá»‡`);
          continue;
        }

        let finalCorrectAnswer = row.correct_answer?.trim() || '';
        let finalQuestionType = row.question_type;

        // â”€â”€ Xá»­ lÃ½ multiple_choice / multiple_select â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (row.question_type === 'multiple_choice' || row.question_type === 'multiple_select') {
          if (!optionsArray || optionsArray.length < 2) {
            errors.push(`DÃ²ng ${i + 1}: CÃ¢u há»i ${row.question_type} cáº§n Ã­t nháº¥t 2 Ä‘Ã¡p Ã¡n`);
            continue;
          }

          // Náº¿u correct_answer rá»—ng â†’ cÃ¢u thÃ´ng tin (Ä‘iá»ƒm 0), cho phÃ©p
          if (!finalCorrectAnswer) {
            if (points > 0) {
              errors.push(`DÃ²ng ${i + 1}: Thiáº¿u Ä‘Ã¡p Ã¡n Ä‘Ãºng cho cÃ¢u há»i cÃ³ Ä‘iá»ƒm`);
              continue;
            }
            // CÃ¢u thÃ´ng tin (Ä‘iá»ƒm 0) â€” lÆ°u bÃ¬nh thÆ°á»ng khÃ´ng cáº§n correct_answer
          } else {
            // Thá»­ resolve correct_answer tá»« options
            const resolved = resolveCorrectAnswers(finalCorrectAnswer, optionsArray);

            if (resolved.length === 0) {
              errors.push(`DÃ²ng ${i + 1}: KhÃ´ng tÃ¬m tháº¥y Ä‘Ã¡p Ã¡n Ä‘Ãºng "${finalCorrectAnswer}" trong danh sÃ¡ch Ä‘Ã¡p Ã¡n`);
              continue;
            }

            if (resolved.length === 1) {
              // Má»™t Ä‘Ã¡p Ã¡n Ä‘Ãºng â†’ multiple_choice
              finalQuestionType = 'multiple_choice';
              finalCorrectAnswer = resolved[0];
            } else {
              // Nhiá»u Ä‘Ã¡p Ã¡n Ä‘Ãºng â†’ multiple_select, lÆ°u JSON array
              finalQuestionType = 'multiple_select';
              finalCorrectAnswer = JSON.stringify(resolved);
            }
          }
        }

        // â”€â”€ true_false â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (row.question_type === 'true_false') {
          if (!optionsArray || optionsArray.length < 2) {
            errors.push(`DÃ²ng ${i + 1}: CÃ¢u há»i true_false cáº§n Ã­t nháº¥t 2 Ä‘Ã¡p Ã¡n`);
            continue;
          }
          if (!finalCorrectAnswer && points > 0) {
            errors.push(`DÃ²ng ${i + 1}: Thiáº¿u Ä‘Ã¡p Ã¡n Ä‘Ãºng`);
            continue;
          }
          if (finalCorrectAnswer) {
            const matched = optionsArray.find(o => o.toLowerCase() === finalCorrectAnswer.toLowerCase());
            if (!matched) {
              errors.push(`DÃ²ng ${i + 1}: ÄÃ¡p Ã¡n Ä‘Ãºng "${finalCorrectAnswer}" khÃ´ng cÃ³ trong danh sÃ¡ch Ä‘Ã¡p Ã¡n`);
              continue;
            }
            finalCorrectAnswer = matched;
          }
        }

        // Insert
        currentOrder++;
        const result = await pool.query(
          `INSERT INTO training_assignment_questions
           (assignment_id, question_text, question_type, correct_answer, options, points, difficulty, explanation, image_url, order_number, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
           RETURNING id`,
          [
            assignmentId,
            row.question_text.trim(),
            finalQuestionType,
            finalCorrectAnswer,
            optionsArray ? JSON.stringify(optionsArray) : null,
            points,
            row.difficulty || 'medium',
            row.explanation?.trim() || '',
            row.image_url?.trim() || null,
            currentOrder
          ]
        );

        imported.push({ id: result.rows[0].id, question_text: row.question_text.trim().slice(0, 60), line: i + 1 });

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
      data: imported
    });

  } catch (error: any) {
    console.error('Error importing questions:', error);
    return NextResponse.json({ success: false, error: error.message || 'Lá»—i khi import cÃ¢u há»i' }, { status: 500 });
  }
}

/**
 * Resolve correct_answer string thÃ nh máº£ng cÃ¡c Ä‘Ã¡p Ã¡n khá»›p vá»›i options.
 *
 * Há»— trá»£ cÃ¡c format:
 * 1. Khá»›p trá»±c tiáº¿p vá»›i 1 option â†’ ["option"]
 * 2. Pipe-separated: "A|B|C" â†’ tÃ¬m tá»«ng pháº§n trong options
 * 3. Dáº¡ng "A, B. ..., D. ..." (tá»« file thá»±c táº¿) â†’ tÃ¡ch vÃ  tÃ¬m trong options
 * 4. Dáº¡ng "A. text, B. text" â†’ tÃ¡ch vÃ  tÃ¬m trong options
 */
function resolveCorrectAnswers(correctAnswer: string, options: string[]): string[] {
  const ca = correctAnswer.trim();
  if (!ca) return [];

  // 1. Khá»›p trá»±c tiáº¿p (case-insensitive)
  const directMatch = options.find(o => o.toLowerCase() === ca.toLowerCase());
  if (directMatch) return [directMatch];

  // 2. Pipe-separated
  if (ca.includes('|')) {
    const parts = ca.split('|').map(p => p.trim()).filter(Boolean);
    const resolved = parts.map(p => options.find(o => o.toLowerCase() === p.toLowerCase())).filter(Boolean) as string[];
    if (resolved.length > 0) return resolved;
  }

  // 3. TÃ¡ch theo dáº¥u pháº©y + loáº¡i bá» prefix "A.", "B.", "C.", "D." náº¿u cÃ³
  // VÃ­ dá»¥: "ÄÃ¡p Ã¡n A, B. ÄÃ¡p Ã¡n B, D. ÄÃ¡p Ã¡n D"
  const commaParts = splitByCommaRespectingOptions(ca, options);
  if (commaParts.length > 1) {
    const resolved = commaParts
      .map(p => {
        const cleaned = p.replace(/^[A-Za-z]\.\s*/, '').trim(); // bá» "A. ", "B. "...
        return options.find(o => o.toLowerCase() === cleaned.toLowerCase() || o.toLowerCase() === p.toLowerCase());
      })
      .filter(Boolean) as string[];
    if (resolved.length > 0) return resolved;
  }

  // 4. TÃ¬m kiáº¿m substring â€” náº¿u correct_answer chá»©a text cá»§a option
  const substringMatches = options.filter(o =>
    ca.toLowerCase().includes(o.toLowerCase()) && o.length > 3
  );
  if (substringMatches.length > 0) return substringMatches;

  return [];
}

/**
 * TÃ¡ch chuá»—i theo dáº¥u pháº©y nhÆ°ng khÃ´ng tÃ¡ch náº¿u pháº§n sau dáº¥u pháº©y
 * lÃ  tiáº¿p ná»‘i cá»§a má»™t option Ä‘ang Ä‘Æ°á»£c match.
 */
function splitByCommaRespectingOptions(text: string, options: string[]): string[] {
  // TÃ¡ch Ä‘Æ¡n giáº£n theo ", " hoáº·c ","
  const rawParts = text.split(/,\s*/).map(p => p.trim()).filter(Boolean);

  // Náº¿u chá»‰ cÃ³ 1 pháº§n â†’ khÃ´ng pháº£i multi
  if (rawParts.length <= 1) return rawParts;

  // Gá»™p láº¡i cÃ¡c pháº§n bá»‹ tÃ¡ch nháº§m (khi option chá»©a dáº¥u pháº©y)
  const result: string[] = [];
  let current = '';

  for (const part of rawParts) {
    current = current ? `${current}, ${part}` : part;
    const cleaned = current.replace(/^[A-Za-z]\.\s*/, '').trim();
    const isMatch = options.some(o =>
      o.toLowerCase() === cleaned.toLowerCase() ||
      o.toLowerCase() === current.toLowerCase()
    );
    if (isMatch) {
      result.push(current);
      current = '';
    }
  }

  // Náº¿u cÃ²n pháº§n dÆ° chÆ°a match â†’ thÃªm vÃ o
  if (current) result.push(current);

  return result.length > 1 ? result : rawParts;
}

function parseCSVLine(line: string): string[] {
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
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
