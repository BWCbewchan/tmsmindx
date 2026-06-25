# Email Quota Monitor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Xây dashboard giám sát sức tải email theo thời gian thực, có khả năng chẩn đoán lỗi và chỉ Super Admin được truy cập.

**Architecture:** Instrument mail transporter để ghi log bất đồng bộ vào PostgreSQL. API quản trị tổng hợp dữ liệu theo cửa sổ thời gian, áp dụng ngưỡng cấu hình và trả dữ liệu cho một dashboard Next.js riêng trong Cấu hình hệ thống.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, PostgreSQL, Nodemailer, SWR/Recharts, Tailwind CSS.

---

### Task 1: Mô hình dữ liệu và logic chẩn đoán

**Files:**
- Create: `migrations/create_email_monitoring.sql`
- Modify: `lib/migrations.ts`
- Create: `lib/email-monitoring.ts`
- Test: `lib/email-monitoring.test.ts`

1. Viết unit test cho phân loại lỗi SMTP, percentile và trạng thái sức khỏe.
2. Chạy test và xác nhận thất bại.
3. Cài đặt logic thuần TypeScript.
4. Chạy lại test.
5. Thêm migration idempotent cho log và settings.

### Task 2: Ghi log tại transporter

**Files:**
- Modify: `app/api/emails/transporter.ts`
- Create: `lib/email-delivery-log.ts`

1. Chuẩn hóa danh sách người nhận và metadata.
2. Đo độ trễ gửi.
3. Ghi `sent`, `failed`, `skipped` mà không làm hỏng luồng gửi chính.
4. Trả thêm message id, response và duration cho caller.

### Task 3: API Super Admin

**Files:**
- Create: `app/api/admin/email-monitor/route.ts`

1. Bảo vệ GET/PATCH/DELETE bằng `requireBearerDbRoles(['super_admin'])`.
2. Tổng hợp chỉ số 24 giờ, 7 ngày, hourly series, error/source breakdown.
3. Hỗ trợ lọc và phân trang log.
4. Cập nhật settings có validate.
5. Dọn log quá hạn.

### Task 4: Dashboard

**Files:**
- Create: `app/admin/email-monitor/page.tsx`
- Create: `components/email-monitor/EmailLoadChart.tsx`
- Create: `components/email-monitor/EmailStatusDonut.tsx`
- Create: `components/email-monitor/types.ts`
- Modify: `components/sidebar.tsx`

1. Thêm menu dưới Cấu hình hệ thống, chỉ hiện cho Super Admin.
2. Tạo trạng thái tổng thể và các KPI.
3. Tạo quota bars và biểu đồ tải.
4. Tạo khung chẩn đoán, cấu hình và bảng log.
5. Thêm auto-refresh 15 giây, bộ lọc và phân trang.

### Task 5: Xác minh

1. Chạy unit test.
2. Chạy lint trên file thay đổi.
3. Chạy build.
4. Chạy migration nếu database khả dụng.
5. Mở `/admin/email-monitor` và kiểm tra bằng trình duyệt.

