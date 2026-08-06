import pool from '@/lib/db';
import { clearK12DocsCache } from '@/lib/k12-docs';

/* ── Style tokens ─────────────────────────────────── */
const S = {
  cell:     'border: 1px solid #cbd5e1; padding: 8px 12px;',
  name:     'color: #0f172a; font-weight: 500;',
  role:     'color: #475569;',
  email:    'color: #2563eb;',
  phone:    'color: #0f172a; text-align: center;',
  tmCell:   'border: 1px solid #cbd5e1; padding: 10px; font-weight: 700; vertical-align: middle; text-align: center; background-color: #f8fafc; color: #0f172a;',
  teglVCell:'border: 1px solid #cbd5e1; padding: 10px; font-weight: 600; vertical-align: middle; text-align: center; background-color: #f8fafc; color: #1e293b;',
  teglCell: 'border: 1px solid #cbd5e1; padding: 10px; font-weight: 600; vertical-align: middle; text-align: center; background-color: #ffffff; color: #334155;',
  areaCell: 'border: 1px solid #cbd5e1; padding: 8px 12px; vertical-align: middle; text-align: center; font-weight: 600; background-color: #f1f5f9; color: #334155;',
};

/* ── Role display label ───────────────────────────── */
const ROLE_LABELS: Record<string, string> = {
  TM:   'Teaching Manager',
  TEGL: 'Teaching Executive Group Lead',
  TE:   'Teaching Executive',
  CL:   'Coding Leader',
  RL:   'Robotic Leader',
  AL:   'Art Leader',
  TC:   'Teacher Coordinator',
};

function roleLabel(code: string, name?: string): string {
  return name || ROLE_LABELS[code] || code;
}

/* ── Types ────────────────────────────────────────── */
interface StaffRow  { name: string; role: string; email: string; phone: string; }
interface AreaBlock { areaLabel: string; staff: StaffRow[]; }
interface TeglBlock { teglName: string; areaBlocks: AreaBlock[]; totalRows: number; }
interface VungBlock { vungName: string; teglBlocks: TeglBlock[]; totalRows: number; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Leader = Record<string, any>;

export async function syncDoc57OrgTable() {
  try {
    const client = await pool.connect();
    try {
      /* ── Phone map ─────────────────────────── */
      const phoneMap = new Map<string, string>();
      const hr = await client.query(
        `SELECT full_name, email, phone FROM hr_candidates WHERE phone IS NOT NULL AND phone <> ''`
      );
      hr.rows.forEach((r) => {
        if (r.full_name) phoneMap.set(r.full_name.trim().toLowerCase(), r.phone);
        if (r.email) phoneMap.set(r.email.trim().toLowerCase(), r.phone);
      });
      const tch = await client.query(
        `SELECT full_name, work_email, personal_email, phone_number FROM teachers WHERE phone_number IS NOT NULL AND phone_number <> ''`
      );
      tch.rows.forEach((r) => {
        let p = r.phone_number.trim();
        if (p.startsWith('84')) p = '0' + p.slice(2);
        if (r.full_name) phoneMap.set(r.full_name.trim().toLowerCase(), p);
        if (r.work_email) phoneMap.set(r.work_email.trim().toLowerCase(), p);
        if (r.personal_email) phoneMap.set(r.personal_email.trim().toLowerCase(), p);
      });

      function getPhone(name: string, email: string): string {
        let p = phoneMap.get(email.trim().toLowerCase()) || phoneMap.get(name.trim().toLowerCase()) || '';
        if (p.startsWith('84')) p = '0' + p.slice(2);
        return p;
      }

      /* ── Load all leaders ──────────────────── */
      const dbRes = await client.query(`
        SELECT code, full_name, email, role_code, role_name, center, area, areas, status
        FROM teaching_leaders
        WHERE status IS NULL OR status <> 'Inactive'
        ORDER BY area, role_code, full_name
      `);
      const allLeaders: Leader[] = dbRes.rows;

      function getAreas(r: Leader): string[] {
        return Array.isArray(r.areas) ? r.areas : (r.area ? [r.area] : []);
      }

      /* ── Classify TEGLs ────────────────────── */
      const tegls = allLeaders.filter((r) => r.role_code === 'TEGL');
      // Sort by area count desc → the widest-scope TEGLs are "TEGL vùng"
      const sortedTegls = [...tegls].sort((a, b) => getAreas(b).length - getAreas(a).length);

      // TEGL vùng: top-level TEGLs whose areas are NOT a subset of any broader TEGL
      // A TEGL X is a sub-TEGL of Y if all of X's areas are contained in Y's areas (and Y is broader)
      const teglVungs: Leader[] = [];
      const subTegls: Leader[] = [];

      sortedTegls.forEach((t) => {
        const tAreas = new Set(getAreas(t));
        const isSubOf = teglVungs.some((v) => {
          const vAreas = getAreas(v);
          // Check if all of t's areas are within v's areas
          return [...tAreas].every((a) => vAreas.includes(a));
        });
        if (isSubOf) {
          subTegls.push(t);
        } else {
          teglVungs.push(t);
        }
      });

      /* ── Staff (CL, RL, AL, TC, TE) ────────── */
      const staffRoles = ['CL', 'RL', 'AL', 'TC', 'TE'];
      const staffLeaders = allLeaders.filter((r) => staffRoles.includes(r.role_code));

      // Group staff by their primary area
      const staffByArea = new Map<string, Leader[]>();
      staffLeaders.forEach((s) => {
        const area = s.area || 'OTHER';
        if (!staffByArea.has(area)) staffByArea.set(area, []);
        staffByArea.get(area)!.push(s);
      });

      /* ── Assign sub-TEGLs to TEGL vùng ─────── */
      function findParentVung(sub: Leader): Leader | undefined {
        const subAreas = new Set(getAreas(sub));
        return teglVungs.find((v) => {
          const vAreas = getAreas(v);
          return [...subAreas].every((a) => vAreas.includes(a));
        });
      }

      // Map: vung code -> sub-TEGLs
      const vungSubMap = new Map<string, Leader[]>();
      teglVungs.forEach((v) => vungSubMap.set(v.code, []));
      subTegls.forEach((s) => {
        const parent = findParentVung(s);
        if (parent) {
          vungSubMap.get(parent.code)!.push(s);
        }
      });

      /* ── Build area block ──────────────────── */
      function buildAreaBlock(areaName: string): AreaBlock | null {
        const staff = staffByArea.get(areaName) || [];
        if (staff.length === 0) return null;
        // Deduplicate by code
        const seen = new Set<string>();
        const unique = staff.filter((s) => {
          if (seen.has(s.code)) return false;
          seen.add(s.code);
          return true;
        });
        return {
          areaLabel: areaName,
          staff: unique.map((s) => ({
            name: s.full_name,
            role: roleLabel(s.role_code, s.role_name),
            email: s.email || '',
            phone: getPhone(s.full_name || '', s.email || ''),
          })),
        };
      }

      /* ── Build TEGL block ──────────────────── */
      function buildTeglBlock(tegl: Leader, assignedAreas: string[]): TeglBlock | null {
        const areaBlocks: AreaBlock[] = [];
        assignedAreas.forEach((a) => {
          const ab = buildAreaBlock(a);
          if (ab) areaBlocks.push(ab);
        });
        if (areaBlocks.length === 0) return null;
        const totalRows = areaBlocks.reduce((s, ab) => s + ab.staff.length, 0);
        return { teglName: tegl.full_name, areaBlocks, totalRows };
      }

      /* ── Build vung blocks ─────────────────── */
      const vungBlocks: VungBlock[] = [];

      teglVungs.forEach((v) => {
        const vAreas = getAreas(v);
        const subs = vungSubMap.get(v.code) || [];
        const teglBlocks: TeglBlock[] = [];

        // Areas already covered by sub-TEGLs
        const coveredAreas = new Set<string>();

        // Sub-TEGLs
        subs.forEach((sub) => {
          const subAreas = getAreas(sub);
          const tb = buildTeglBlock(sub, subAreas);
          if (tb) {
            teglBlocks.push(tb);
            subAreas.forEach((a) => coveredAreas.add(a));
          }
        });

        // Direct areas (covered by vùng TEGL, not any sub)
        const directAreas = vAreas.filter((a) => !coveredAreas.has(a));
        if (directAreas.length > 0) {
          const tb = buildTeglBlock(v, directAreas);
          if (tb) teglBlocks.push(tb);
        }

        const totalRows = teglBlocks.reduce((s, tb) => s + tb.totalRows, 0);
        if (totalRows > 0) {
          vungBlocks.push({ vungName: v.full_name, teglBlocks, totalRows });
        }
      });

      const grandTotal = vungBlocks.reduce((s, v) => s + v.totalRows, 0);

      /* ── TM ────────────────────────────────── */
      const tm = allLeaders.find((r) => r.role_code === 'TM');
      const tmName = tm?.full_name || 'Nguyễn Trung Hiếu';

      /* ── Generate HTML ─────────────────────── */
      let rows = '';
      let isFirstRow = true;

      vungBlocks.forEach((vung, vi) => {
        let isFirstTeglInVung = true;

        vung.teglBlocks.forEach((tegl) => {
          let isFirstAreaInTegl = true;

          tegl.areaBlocks.forEach((area) => {
            let isFirstStaffInArea = true;

            area.staff.forEach((staff) => {
              rows += '<tr>\n';

              // TM cell (only first row of entire table)
              if (isFirstRow) {
                rows += `<td rowspan="${grandTotal}" style="${S.tmCell}">${tmName}</td>\n`;
              }

              // TEGL vùng cell (first row of this vùng)
              if (isFirstTeglInVung && isFirstAreaInTegl && isFirstStaffInArea) {
                rows += `<td rowspan="${vung.totalRows}" style="${S.teglVCell}">${vung.vungName}</td>\n`;
              }

              // TEGL cell (first row of this tegl block)
              if (isFirstAreaInTegl && isFirstStaffInArea) {
                rows += `<td rowspan="${tegl.totalRows}" style="${S.teglCell}">${tegl.teglName}</td>\n`;
              }

              // Staff name & role
              rows += `<td style="${S.cell} ${S.name}">${staff.name}</td>\n`;
              rows += `<td style="${S.cell} ${S.role}">${staff.role}</td>\n`;

              // Area cell (first row of this area)
              if (isFirstStaffInArea) {
                rows += `<td rowspan="${area.staff.length}" style="${S.areaCell}">${area.areaLabel}</td>\n`;
              }

              // Email & phone
              rows += `<td style="${S.cell} ${S.email}">${staff.email}</td>\n`;
              rows += `<td style="${S.cell} ${S.phone}">${staff.phone}</td>\n`;
              rows += '</tr>\n';

              isFirstRow = false;
              isFirstStaffInArea = false;
            });
            isFirstAreaInTegl = false;
          });
          isFirstTeglInVung = false;
        });
      });

      const tableHtml = `<div style="overflow-x: auto; margin-top: 1.5rem; margin-bottom: 1.5rem; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
<table style="width: 100%; border-collapse: collapse; font-size: 13px; font-family: system-ui, -apple-system, sans-serif; text-align: left; background-color: #ffffff;">
<thead>
<tr style="background-color: #a1001f; color: #ffffff; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 0.025em;">
<th style="border: 1px solid #cbd5e1; padding: 10px 12px; min-width: 120px;">TM</th>
<th style="border: 1px solid #cbd5e1; padding: 10px 12px; min-width: 110px;">TEGL vùng</th>
<th style="border: 1px solid #cbd5e1; padding: 10px 12px; min-width: 140px;">TEGL</th>
<th style="border: 1px solid #cbd5e1; padding: 10px 12px; min-width: 170px;">Leader/TE/TC</th>
<th style="border: 1px solid #cbd5e1; padding: 10px 12px; min-width: 130px;">Vai trò</th>
<th style="border: 1px solid #cbd5e1; padding: 10px 12px; min-width: 130px;">Khu vực quản lý</th>
<th style="border: 1px solid #cbd5e1; padding: 10px 12px; min-width: 190px;">Email</th>
<th style="border: 1px solid #cbd5e1; padding: 10px 12px; min-width: 120px;">Số điện thoại</th>
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>
</div>`;

      /* ── Update document ───────────────────── */
      const docRes = await client.query('SELECT content FROM k12_documents WHERE id = 57');
      if (docRes.rows.length > 0) {
        let content = docRes.rows[0].content;
        const contactHeader = '## Thông tin liên hệ:';
        const contactIdx = content.indexOf(contactHeader);

        if (contactIdx !== -1) {
          content = content.substring(0, contactIdx + contactHeader.length) + '\n\n' + tableHtml.trim();
        } else {
          content = content + '\n\n' + contactHeader + '\n\n' + tableHtml.trim();
        }

        await client.query('UPDATE k12_documents SET content = $1 WHERE id = 57', [content]);
      }

      // Invalidate memory cache so next request loads fresh data
      clearK12DocsCache();
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error syncing Doc 57 org table:', error);
  }
}
