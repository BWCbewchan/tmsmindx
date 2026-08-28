const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log('=== 1. SCANNING HTML / MARKDOWN SYNTAX IN ALL 78 LEADER DOCUMENTS ===\n');
  const res = await pool.query('SELECT id, slug, title, content FROM k12_leader_documents ORDER BY sort_order ASC, id ASC');
  
  const errors = [];

  for (const doc of res.rows) {
    const c = doc.content || '';

    // Check for unclosed tags or broken attribute syntax
    // 1. Broken style attributes like style="..."" or style='...''
    const brokenStyle = c.match(/style=["'][^"']*["']["']/gi);
    if (brokenStyle) {
      errors.push(`[Doc #${doc.id} ${doc.title}] Broken style attribute: ${brokenStyle.join(', ')}`);
    }

    // 2. Broken img tags like <img src="" /> without src or broken src
    const brokenImg = c.match(/<img[^>]*src=["']\s*["'][^>]*>/gi);
    if (brokenImg) {
      errors.push(`[Doc #${doc.id} ${doc.title}] Empty img src`);
    }

    // 3. Check for unescaped standalone < or > that might break HTML parser
    // e.g. "a < b" where < is not part of a tag
    const rogueLess = c.match(/<(?![a-zA-Z0-9\/!_?-])/g);
    if (rogueLess) {
      errors.push(`[Doc #${doc.id} ${doc.title}] Rogue '<' character not in tag: count=${rogueLess.length}`);
    }

    // 4. Check for double quotes inside double quoted attributes like src="https://...&id="xyz""
    const nestedQuotes = c.match(/=["][^"]*["][^">]+["]/g);
    if (nestedQuotes) {
      errors.push(`[Doc #${doc.id} ${doc.title}] Nested unescaped quotes: ${nestedQuotes.join(', ')}`);
    }

    // 5. Check for invalid HTML entity codes like &#; or &invalid;
    const brokenEntities = c.match(/&[a-zA-Z0-9#]+(?![a-zA-Z0-9#;])/g);
    // Find unescaped ampersands that are not valid entities
    const rawAmpersands = c.match(/&(?!(amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-fA-F]+|[a-zA-Z]{2,8});)/g);
    if (rawAmpersands) {
      console.log(`ℹ️ [Doc #${doc.id} ${doc.title}] Contains ${rawAmpersands.length} raw ampersands '&' (standard in markdown)`);
    }
  }

  console.log(`\nSyntax scan completed. Found ${errors.length} syntax issues.`);
  errors.forEach(e => console.log('❌', e));

  await pool.end();
}

main().catch(console.error);
