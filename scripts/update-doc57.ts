import 'dotenv/config';
import pool from '../lib/db';

async function updateDoc57() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT content FROM k12_documents WHERE id = 57');
    let content = res.rows[0].content;

    // Fetch TE and Leaders from TPS
    // TE: TE, TC
    // Leader: CL, AL, RL
    const leadersRes = await client.query(`
      SELECT full_name, email, role_name, center, area, areas
      FROM teaching_leaders
      WHERE role_code IN ('TE', 'TC', 'CL', 'AL', 'RL') AND status = 'Active'
      ORDER BY role_code, area, full_name
    `);

    const leaders = leadersRes.rows;

    let tableMd = `\n\n### Danh sách TE & Leader\n\n| Họ và tên | Email | Vị trí | Khu vực quản lý | Cơ sở |\n| --- | --- | --- | --- | --- |\n`;
    for (const l of leaders) {
      // Parse areas properly since it can be JSONB array
      let displayArea = l.area || '';
      try {
        if (Array.isArray(l.areas) && l.areas.length > 0) {
          displayArea = l.areas.join(', ');
        }
      } catch (e) {}

      tableMd += `| ${l.full_name} | ${l.email || ''} | ${l.role_name} | ${displayArea} | ${l.center || ''} |\n`;
    }

    // Replace old table if exists, or just append
    if (content.includes('### Danh sách TE & Leader')) {
      const parts = content.split('### Danh sách TE & Leader');
      content = parts[0] + tableMd.trim();
    } else {
      content = content + tableMd;
    }

    await client.query('UPDATE k12_documents SET content = $1 WHERE id = 57', [content]);
    console.log('Document 57 updated successfully with table of', leaders.length, 'leaders.');
  } catch (error) {
    console.error(error);
  } finally {
    client.release();
  }
}

updateDoc57().then(() => process.exit(0));
