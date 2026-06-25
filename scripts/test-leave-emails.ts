import 'dotenv/config'
import { renderTemplate } from '../app/api/emails/render'
import { sendMail } from '../app/api/emails/transporter'

const testTo = process.argv[2] || 'baotc@mindx.com.vn'
const sample = process.argv[3] || 'all'

function formatDateTime(input?: string) {
  if (!input) return ''
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return input
  return d.toLocaleString('vi-VN')
}

function formatDate(input?: string) {
  if (!input) return ''
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return input
  return d.toLocaleDateString('vi-VN')
}

async function sendApprovedSample() {
  const data = {
    teacher_name: 'Nguyễn Văn Test',
    teacher_email: testTo,
    campus: 'MindX Cầu Giấy',
    class_code: 'PY-TEST-01',
    leave_date: formatDate('2026-06-20'),
    class_time: '18:00 - 20:00, Thứ 6',
    leave_session: 'Buổi tối',
    substitute_teacher: 'Trần Thị Test',
    substitute_email: testTo,
    reason: 'Email test hệ thống — có việc gia đình',
    admin_note: 'TC đã duyệt — test mail mẫu 1',
    admin_name: 'Admin TC Test',
    admin_email: testTo,
    substitute_confirmed_at: formatDateTime(new Date().toISOString()),
  }

  const html = renderTemplate('leave-approved-substitute-confirmed', data)
  const result = await sendMail({
    to: testTo,
    subject: `[MindX | THÔNG BÁO XIN NGHỈ 1 BUỔI] Test logo hiển thị — ${data.teacher_name}`,
    html,
    emailType: 'leave_approved_substitute_confirmed',
    source: 'scripts/test-leave-emails',
    metadata: { test: true, sample: 1 },
  })
  console.log('Mẫu 1:', result.sent ? 'OK' : 'FAIL', result)
}

async function sendRejectedSample() {
  const data = {
    request_id: 'TEST-999',
    teacher_name: 'Nguyễn Văn Test',
    campus: 'MindX Cầu Giấy',
    class_code: 'PY-TEST-01',
    leave_date: formatDate('2026-06-20'),
    class_time: '18:00 - 20:00, Thứ 6',
    leave_session: 'Buổi tối',
    reason: 'Email test hệ thống — xin nghỉ 1 buổi',
    admin_note: 'Không đủ điều kiện — test mail mẫu 2',
    admin_name: 'Admin TC Test',
    admin_email: testTo,
  }

  const html = renderTemplate('leave-admin-rejected', data)
  const result = await sendMail({
    to: testTo,
    subject: `[MindX | Xin nghỉ 1 buổi] Test logo hiển thị — ${data.teacher_name}`,
    html,
    emailType: 'leave_admin_rejected',
    source: 'scripts/test-leave-emails',
    metadata: { test: true, sample: 2 },
  })
  console.log('Mẫu 2:', result.sent ? 'OK' : 'FAIL', result)
}

async function main() {
  console.log('Gửi mail test xin nghỉ tới:', testTo, '| sample:', sample)
  if (sample === '1' || sample === 'all') await sendApprovedSample()
  if (sample === '2' || sample === 'all') await sendRejectedSample()
  console.log('Hoàn tất')
}

main().catch((error) => {
  console.error('FAIL:', error instanceof Error ? error.message : error)
  process.exit(1)
})
