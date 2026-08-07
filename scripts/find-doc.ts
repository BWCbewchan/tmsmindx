import 'dotenv/config';
import pool from '../lib/db';

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT content FROM k12_documents WHERE id = 90');
    if (res.rows.length > 0) {
      console.log(res.rows[0].content);
    }
  } finally {
    client.release();
    process.exit(0);
  }
}
main();
