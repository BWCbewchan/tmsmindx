import 'dotenv/config';
import pool from '../lib/db';

async function checkPhones() {
  const resTeachers = await pool.query(`
    SELECT work_email, personal_email, phone_number, full_name, code FROM teachers WHERE phone_number IS NOT NULL AND phone_number <> ''
  `);

  const phoneMap = new Map<string, string>();
  for (const r of resTeachers.rows) {
    if (r.work_email) phoneMap.set(r.work_email.trim().toLowerCase(), r.phone_number);
    if (r.personal_email) phoneMap.set(r.personal_email.trim().toLowerCase(), r.phone_number);
  }

  const resLeaders = await pool.query(`
    SELECT code, full_name, email, role_name FROM teaching_leaders
  `);
  
  console.log('\n--- LEADER PHONE MATCHES ---');
  for (const l of resLeaders.rows) {
    const email = (l.email || '').trim().toLowerCase();
    const phone = phoneMap.get(email) || '';
    console.log(`Email: ${email} | Name: ${l.full_name} | Role: ${l.role_name} | Phone: ${phone}`);
  }
}

checkPhones().then(() => process.exit(0)).catch(console.error);
