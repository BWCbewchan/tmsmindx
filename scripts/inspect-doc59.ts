import 'dotenv/config';
import pool from '../lib/db';

async function checkDoc59() {
  const client = await pool.connect();
  try {
    const res = await client.query(`SELECT id, slug, title, content FROM k12_documents WHERE id = 59 OR slug ILIKE '%huong-dan-nhan-xet-voi-phu-huynh%'`);
    console.log(`Found ${res.rows.length} docs:`);
    res.rows.forEach(r => {
      console.log(`\n=== DOC #${r.id}: ${r.title} ===`);
      console.log(r.content);
    });
  } finally {
    client.release();
    process.exit(0);
  }
}

checkDoc59();
