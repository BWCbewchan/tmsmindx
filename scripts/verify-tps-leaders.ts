import 'dotenv/config';
import pool from '../lib/db';

async function verifyTpsLeaders() {
  const client = await pool.connect();
  try {
    const dbLeaders = await client.query(`
      SELECT code, full_name, email, role_code, role_name, center, area, areas, status
      FROM teaching_leaders
      ORDER BY status ASC, role_code ASC, full_name ASC
    `);

    console.log('=== TPS TEACHING LEADERS TABLE (' + dbLeaders.rows.length + ' records) ===\n');

    const activeLeaders = dbLeaders.rows.filter(r => r.status === 'Active');
    const deactiveLeaders = dbLeaders.rows.filter(r => r.status !== 'Active');

    console.log('--- ACTIVE LEADERS (' + activeLeaders.length + ') ---');
    activeLeaders.forEach(l => {
      console.log(`[${l.role_code}] ${l.full_name} (${l.role_name}) | Email: ${l.email || 'N/A'} | Area: ${l.area || ''} | Center: ${l.center || ''}`);
    });

    if (deactiveLeaders.length > 0) {
      console.log('\n--- DEACTIVE LEADERS (' + deactiveLeaders.length + ') ---');
      deactiveLeaders.forEach(l => {
        console.log(`[${l.role_code}] ${l.full_name} (${l.role_name}) | Email: ${l.email || 'N/A'}`);
      });
    }

    // Now inspect Doc 57 table rows
    const docRes = await client.query('SELECT content FROM k12_documents WHERE id = 57');
    const content = docRes.rows[0].content;

    console.log('\n=== CHECKING DOC 57 MATCHES WITH TPS ===');
    // Check if active leaders in TPS are in doc 57
    activeLeaders.forEach(l => {
      if (l.email) {
        const inDoc = content.includes(l.email.trim());
        console.log(`- ${l.full_name} (${l.email}): ${inDoc ? '✅ In Doc 57' : '❌ MISSING in Doc 57'}`);
      }
    });

  } finally {
    client.release();
  }
}

verifyTpsLeaders().then(() => process.exit(0)).catch(console.error);
