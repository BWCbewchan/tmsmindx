import 'dotenv/config';
import pool from '../lib/db';
import bcrypt from 'bcryptjs';

async function setAdminPassword() {
  const client = await pool.connect();
  try {
    const hash = await bcrypt.hash('12345678', 10);
    await client.query(
      `UPDATE app_users 
       SET password_hash = $1, auth_type = 'app', is_active = true 
       WHERE email = 'hoteaching@mindx.com.vn'`,
      [hash]
    );
    console.log('Admin password set to 12345678 successfully!');
  } finally {
    client.release();
  }
}

setAdminPassword().then(() => process.exit(0)).catch(console.error);
