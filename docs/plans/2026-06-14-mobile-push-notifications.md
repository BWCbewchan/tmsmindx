# Mobile Push Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Hỗ trợ Web Push cho Android và iOS PWA từ mục cài đặt thông báo.

**Architecture:** Client đăng ký service worker và PushSubscription bằng VAPID public key, API lưu subscription theo phiên đăng nhập. Notification service gửi Web Push song song với việc lưu thông báo trong ứng dụng và tự dọn endpoint hết hạn.

**Tech Stack:** Next.js App Router, React, PostgreSQL, Service Worker, Push API, `web-push`.

---

### Task 1: Nền tảng Web Push

**Files:**
- Create: `lib/push-notifications.ts`
- Create: `public/sw.js`
- Modify: `app/layout.tsx`
- Test: `tests/push-notifications.test.ts`

1. Viết test cho nhận diện iOS, standalone và chuyển VAPID public key.
2. Tạo helper client/server dùng chung kiểu dữ liệu.
3. Thêm web manifest metadata và service worker xử lý `push`/`notificationclick`.
4. Chạy unit test và TypeScript.

### Task 2: Lưu đăng ký thiết bị

**Files:**
- Modify: `lib/migrations.ts`
- Modify: `scripts/run-all-migrations.js`
- Create: `app/api/push-subscriptions/route.ts`

1. Thêm bảng `push_subscriptions` có unique endpoint, email, keys, user agent và timestamps.
2. Thêm GET/POST/DELETE có xác thực session và kiểm tra same-origin mutation.
3. Thêm POST action gửi thử tới chính thiết bị đã đăng ký.
4. Chạy migration và kiểm tra API.

### Task 3: Gửi push khi tạo thông báo

**Files:**
- Modify: `lib/notification-service.ts`
- Modify: `.env.example`
- Modify: `package.json`
- Modify: `package-lock.json`

1. Cài `web-push`.
2. Tạo hàm gửi payload cho subscription của người nhận.
3. Gọi gửi push sau khi ghi thông báo trong ứng dụng.
4. Xóa endpoint hết hạn và không làm hỏng luồng chính khi push lỗi.

### Task 4: Giao diện mobile

**Files:**
- Create: `components/notifications/DevicePushSetting.tsx`
- Modify: `app/user/thong-bao/page.tsx`
- Modify: `components/NotificationBell.tsx`

1. Tách logic đăng ký push thành component dùng chung.
2. Hiển thị hướng dẫn riêng cho iOS chưa chạy standalone.
3. Dùng service worker để gửi thông báo thử, không dùng `new Notification()` trên mobile.
4. Chỉnh bố cục hàng cài đặt cho màn hình hẹp.

### Task 5: Xác minh

1. Chạy unit test, ESLint và TypeScript.
2. Test Android `412x915`.
3. Test iPhone `390x844`, xác minh hướng dẫn cài PWA.
4. Kiểm tra không có overflow và không có lỗi console.

