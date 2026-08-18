import 'dotenv/config';
import pool from '../lib/db';

async function updateDoc57OrgTableWithLatestTps() {
  const client = await pool.connect();
  try {
    // Build phone map from teachers & hr_candidates
    const phoneMap = new Map<string, string>();
    const hr = await client.query('SELECT full_name, email, phone FROM hr_candidates WHERE phone IS NOT NULL AND phone <> \'\'');
    hr.rows.forEach(r => {
      if (r.full_name) phoneMap.set(r.full_name.trim().toLowerCase(), r.phone);
      if (r.email) phoneMap.set(r.email.trim().toLowerCase(), r.phone);
    });

    const tch = await client.query('SELECT full_name, work_email, personal_email, phone_number FROM teachers WHERE phone_number IS NOT NULL AND phone_number <> \'\'');
    tch.rows.forEach(r => {
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

<!-- BLOCK 1: Trần Huy Vũ (23 rows) -->

<!-- 1.1 Phan Ngọc Hoàng Anh (8 rows) -->
<!-- HCM1 (4 rows) -->
<tr>
<td rowspan="38" style="border: 1px solid #cbd5e1; padding: 10px; font-weight: 700; vertical-align: middle; text-align: center; background-color: #f8fafc; color: #0f172a;">Nguyễn Trung Hiếu</td>
<td rowspan="23" style="border: 1px solid #cbd5e1; padding: 10px; font-weight: 600; vertical-align: middle; text-align: center; background-color: #f8fafc; color: #1e293b;">Trần Huy Vũ</td>
<td rowspan="8" style="border: 1px solid #cbd5e1; padding: 10px; font-weight: 600; vertical-align: middle; text-align: center; background-color: #ffffff; color: #334155;">Phan Ngọc Hoàng Anh</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Nguyễn Hoàng Khôi Nguyên</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Coding Leader</td>
<td rowspan="4" style="border: 1px solid #cbd5e1; padding: 8px 12px; vertical-align: middle; text-align: center; font-weight: 600; background-color: #f1f5f9; color: #334155;">HCM1</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">nguyennhk@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Nguyễn Hoàng Khôi Nguyên', 'nguyennhk@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Trần Chí Bảo</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Robotic Leader</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">baotc@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Trần Chí Bảo', 'baotc@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Đặng Trần Trà My</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Art Leader</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">mydtt01@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Đặng Trần Trà My', 'mydtt01@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Trương Thị Thanh Bình</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Teacher Coordinator</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">binhttt@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Trương Thị Thanh Bình', 'binhttt@mindx.com.vn')}</td>
</tr>

<!-- HCM4 (4 rows) -->
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Nguyễn Hoàng Tuấn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Coding Leader</td>
<td rowspan="4" style="border: 1px solid #cbd5e1; padding: 8px 12px; vertical-align: middle; text-align: center; font-weight: 600; background-color: #f1f5f9; color: #334155;">HCM4</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">tuannh@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Nguyễn Hoàng Tuấn', 'tuannh@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Trần Chí Bảo</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Robotic Leader</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">baotc@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Trần Chí Bảo', 'baotc@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Đặng Trần Trà My</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Art Leader</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">mydtt01@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Đặng Trần Trà My', 'mydtt01@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Trương Thị Thanh Bình</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Teacher Coordinator</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">binhttt@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Trương Thị Thanh Bình', 'binhttt@mindx.com.vn')}</td>
</tr>

<!-- 1.2 Cao Quang Sơn (8 rows) -->
<!-- HCM2 (4 rows) -->
<tr>
<td rowspan="8" style="border: 1px solid #cbd5e1; padding: 10px; font-weight: 600; vertical-align: middle; text-align: center; background-color: #ffffff; color: #334155;">Cao Quang Sơn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Nguyễn Gia Thịnh</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Coding Leader</td>
<td rowspan="4" style="border: 1px solid #cbd5e1; padding: 8px 12px; vertical-align: middle; text-align: center; font-weight: 600; background-color: #f1f5f9; color: #334155;">HCM2</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">thinhng@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Nguyễn Gia Thịnh', 'thinhng@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Lê Hồng Quân</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Robotic Leader</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">quanlh@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Lê Hồng Quân', 'quanlh@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Phan Hồ Triều Tiên</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Art Leader</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">tienpht@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Phan Hồ Triều Tiên', 'tienpht@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Hà Vũ Thanh Huyền</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Teacher Coordinator</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">huyenhvt@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Hà Vũ Thanh Huyền', 'huyenhvt@mindx.com.vn')}</td>
</tr>

<!-- HCM3 (4 rows) -->
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Nguyễn Huy Hoàng</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Coding Leader</td>
<td rowspan="4" style="border: 1px solid #cbd5e1; padding: 8px 12px; vertical-align: middle; text-align: center; font-weight: 600; background-color: #f1f5f9; color: #334155;">HCM3</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">hoangnh03@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Nguyễn Huy Hoàng', 'hoangnh03@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Lê Hồng Quân</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Robotic Leader</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">quanlh@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Lê Hồng Quân', 'quanlh@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Phan Hồ Triều Tiên</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Art Leader</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">tienpht@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Phan Hồ Triều Tiên', 'tienpht@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Hà Vũ Thanh Huyền</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Teacher Coordinator</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">huyenhvt@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Hà Vũ Thanh Huyền', 'huyenhvt@mindx.com.vn')}</td>
</tr>

<!-- 1.3 Trần Văn Nghĩa (7 rows) -->
<tr>
<td rowspan="7" style="border: 1px solid #cbd5e1; padding: 10px; font-weight: 600; vertical-align: middle; text-align: center; background-color: #ffffff; color: #334155;">Trần Văn Nghĩa</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Nguyễn Trung</td>
<td rowspan="16" style="border: 1px solid #cbd5e1; padding: 8px 12px; vertical-align: middle; text-align: center; font-weight: 600; color: #475569; background-color: #fafafa;">Teaching Executive</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 500; color: #334155;">HCM Online</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">trungn@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Nguyễn Trung', 'trungn@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Phạm Thanh Nhàn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 500; color: #334155;">MindX Digital Art</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">nhanpt@mindx.net.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Phạm Thanh Nhàn', 'nhanpt@mindx.net.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Trần Anh Vũ</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 500; color: #334155;">Biên Hòa</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">vuta@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Trần Anh Vũ', 'vuta@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Cao Duy Quang</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 500; color: #334155;">Dĩ An</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">quangcd@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Cao Duy Quang', 'quangcd@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Phạm Anh Tuấn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 500; color: #334155;">Vũng Tàu</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">tuanpa@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Phạm Anh Tuấn', 'tuanpa@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Nguyễn Trung</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 500; color: #334155;">Cần Thơ</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">trungn@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Nguyễn Trung', 'trungn@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Lê Thế Khiêm</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 500; color: #334155;">Thủ Dầu Một</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">khiemlt@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Lê Thế Khiêm', 'khiemlt@mindx.com.vn')}</td>
</tr>

<!-- BLOCK 2: Nguyễn Hồng Hà (9 rows) -->

<!-- 2.1 Phạm Tiến Thịnh (7 rows) -->
<tr>
<td rowspan="9" style="border: 1px solid #cbd5e1; padding: 10px; font-weight: 600; vertical-align: middle; text-align: center; background-color: #f8fafc; color: #1e293b;">Nguyễn Hồng Hà</td>
<td rowspan="7" style="border: 1px solid #cbd5e1; padding: 10px; font-weight: 600; vertical-align: middle; text-align: center; background-color: #ffffff; color: #334155;">Phạm Tiến Thịnh</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Phạm Tiến Thịnh</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 500; color: #334155;">Hải Phòng</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">thinhpt@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Phạm Tiến Thịnh', 'thinhpt@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Nguyễn Tiến Đạt</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 500; color: #334155;">Quảng Ninh</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">datnt12@mindx.net.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Nguyễn Tiến Đạt', 'datnt12@mindx.net.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Giáp Hoàng Sơn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 500; color: #334155;">Bắc Ninh</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">songh@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Giáp Hoàng Sơn', 'songh@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Đỗ Tuấn Minh</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 500; color: #334155;">Thái Nguyên</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">minhdt@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Đỗ Tuấn Minh', 'minhdt@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Nguyễn Ngọc Khánh</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 500; color: #334155;">Vĩnh Phúc</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">khanhnn@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Nguyễn Ngọc Khánh', 'khanhnn@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Lê Quý Vương</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 500; color: #334155;">Phú Thọ</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">vuonglq@mindx.net.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Lê Quý Vương', 'vuonglq@mindx.net.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Nguyễn Trọng Quý Mạnh</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 500; color: #334155;">Đà Nẵng</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">nguyentrongquymanh@mindx.net.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Nguyễn Trọng Quý Mạnh', 'nguyentrongquymanh@mindx.net.vn')}</td>
</tr>

<!-- 2.2 Nguyễn Cảnh An (2 rows) -->
<tr>
<td rowspan="2" style="border: 1px solid #cbd5e1; padding: 10px; font-weight: 600; vertical-align: middle; text-align: center; background-color: #ffffff; color: #334155;">Nguyễn Cảnh An</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Lê Khánh Tùng</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 500; color: #334155;">Thanh Hóa</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">tunglk@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Lê Khánh Tùng', 'tunglk@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Nguyễn Cảnh An</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 500; color: #334155;">Nghệ An</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">annc@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Nguyễn Cảnh An', 'annc@mindx.com.vn')}</td>
</tr>

<!-- BLOCK 3: Hoàng Việt Hùng (6 rows) -->
<tr>
<td rowspan="6" style="border: 1px solid #cbd5e1; padding: 10px; font-weight: 600; vertical-align: middle; text-align: center; background-color: #f8fafc; color: #1e293b;">Hoàng Việt Hùng</td>
<td rowspan="6" style="border: 1px solid #cbd5e1; padding: 10px; font-weight: 600; vertical-align: middle; text-align: center; background-color: #ffffff; color: #334155;">-</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Nguyễn Hà Thanh</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Art Leader</td>
<td rowspan="3" style="border: 1px solid #cbd5e1; padding: 8px 12px; vertical-align: middle; text-align: center; font-weight: 600; background-color: #f1f5f9; color: #334155;">HN1</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">thanhnh@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Nguyễn Hà Thanh', 'thanhnh@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Nguyễn Việt Ngọc Linh</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Teacher Coordinator</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">linhnvn@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Nguyễn Việt Ngọc Linh', 'linhnvn@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Bùi Hoàng Long</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Coding Leader</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">longbh@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Bùi Hoàng Long', 'longbh@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Bùi Hoàng Long</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Coding Leader</td>
<td rowspan="3" style="border: 1px solid #cbd5e1; padding: 8px 12px; vertical-align: middle; text-align: center; font-weight: 600; background-color: #f1f5f9; color: #334155;">HN2</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">longbh@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Bùi Hoàng Long', 'longbh@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Nguyễn Hà Thanh</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Art Leader</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">thanhnh@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Nguyễn Hà Thanh', 'thanhnh@mindx.com.vn')}</td>
</tr>
<tr>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; font-weight: 500;">Nguyễn Trọng Cường</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #475569;">Teacher Coordinator</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #2563eb;">cuongnt@mindx.com.vn</td>
<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #0f172a; text-align: center;">${getPhone('Nguyễn Trọng Cường', 'cuongnt@mindx.com.vn')}</td>
</tr>
</tbody>
</table>
</div>`;

    const res = await client.query('SELECT content FROM k12_documents WHERE id = 57');
    let content = res.rows[0].content;

    const contactHeader = '## Thông tin liên hệ:';
    const contactIdx = content.indexOf(contactHeader);

    if (contactIdx !== -1) {
      content = content.substring(0, contactIdx + contactHeader.length) + '\n\n' + tableHtml.trim();
    } else {
      content = content + '\n\n' + contactHeader + '\n\n' + tableHtml.trim();
    }

    await client.query('UPDATE k12_documents SET content = $1 WHERE id = 57', [content]);
    console.log('Updated Doc 57 with latest TPS data (including Đà Nẵng: Nguyễn Trọng Quý Mạnh).');
  } catch (error) {
    console.error(error);
  } finally {
    client.release();
  }
}

updateDoc57OrgTableWithLatestTps().then(() => process.exit(0));
