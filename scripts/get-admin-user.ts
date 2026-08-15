import 'dotenv/config';
import pool from '../lib/db';

async function getAdminUser() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT username, email, role FROM app_users LIMIT 5');
    console.log('App Users:', res.rows);
  } finally {
    client.release();
  }
}

getAdminUser().then(() => process.exit(0)).catch(console.error);
