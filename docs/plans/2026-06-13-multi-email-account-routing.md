# Multi Email Account Routing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Quản lý nhiều tài khoản Gmail, round-robin bằng database lock và hiển thị quota To/CC riêng trên màn hình Giám sát Email.

**Architecture:** Credential env được giữ trong env, credential thêm từ UI được mã hóa AES-256-GCM trong PostgreSQL. Một transaction khóa routing state để chọn tài khoản kế tiếp; delivery log là nguồn dữ liệu quota 24 giờ.

**Tech Stack:** Next.js 16 App Router, TypeScript, PostgreSQL, Nodemailer, Node crypto, React 19.

---

### Task 1: Schema và logic lõi

**Files:**
- Modify: `lib/migrations.ts`
- Create: `migrations/create_multi_email_accounts.sql`
- Create: `lib/email-account-crypto.ts`
- Create: `lib/email-account-router.ts`
- Test: `lib/email-account-router.test.ts`

1. Viết test thất bại cho AES-GCM và vòng lặp lựa chọn account.
2. Chạy test để xác nhận RED.
3. Thêm migration và implementation tối thiểu.
4. Chạy test để xác nhận GREEN.

### Task 2: SMTP router và delivery log

**Files:**
- Modify: `app/api/emails/transporter.ts`
- Modify: `lib/email-delivery-log.ts`

1. Thay transporter singleton bằng transporter theo account.
2. Đồng bộ hai account env vào registry.
3. Chọn account trong transaction trước mỗi lần gửi.
4. Ghi account id cùng số lượng To/CC riêng.

### Task 3: API quản lý account

**Files:**
- Modify: `app/api/admin/email-monitor/route.ts`

1. Mở rộng GET trả account quota.
2. Thêm action tạo account database và kiểm tra kết nối.
3. Thêm PATCH cập nhật quota/trạng thái.
4. Thêm DELETE account database.
5. Đảm bảo response không chứa credential.

### Task 4: UI dùng design system hiện có

**Files:**
- Modify: `app/admin/email-monitor/page.tsx`
- Modify: `components/email-monitor/types.ts`

1. Đổi toast sang `@/lib/app-toast`.
2. Thay phần tử thao tác bằng Button/Card/Dialog/Input/Label/Badge/Table hiện có.
3. Thêm card account với hai quota bar To và CC.
4. Thêm dialog tạo/sửa account và thao tác kiểm tra kết nối.

### Task 5: Cấu hình và xác minh

**Files:**
- Modify ignored local file: `.env`

1. Thêm account env thứ hai và encryption key.
2. Chạy migration.
3. Chạy unit test, TypeScript, ESLint và build.
4. Gọi API bằng cookie Super Admin để xác minh hai account env xuất hiện.
