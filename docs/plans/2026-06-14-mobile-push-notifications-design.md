# Mobile Push Notifications Design

## Mục tiêu

Biến mục "Thông báo thiết bị" thành Web Push thực sự trên Android và iOS, đồng thời giữ thông báo trong ứng dụng làm phương án dự phòng.

## Thiết kế

- Đăng ký service worker tại `/sw.js` để hiển thị thông báo khi trang không mở.
- Dùng Push API và VAPID để đăng ký từng trình duyệt/thiết bị.
- Lưu subscription theo email đăng nhập và endpoint duy nhất trong PostgreSQL.
- Khi tạo thông báo trong ứng dụng, gửi cùng nội dung tới các subscription đang hoạt động của người nhận.
- Xóa subscription hết hạn khi push service trả về `404` hoặc `410`.
- Android Chrome/Edge có thể bật trực tiếp từ website HTTPS.
- iOS/iPadOS chỉ cho bật khi website đã được thêm vào Màn hình chính và chạy ở chế độ standalone; giao diện phải hướng dẫn đúng thay vì hiện công tắc không hoạt động.
- Nếu trình duyệt không hỗ trợ hoặc thiếu cấu hình VAPID, vẫn giữ thông báo trong ứng dụng và hiển thị lý do rõ ràng.

## Giao diện

- Công tắc có trạng thái: đang kiểm tra, có thể bật, đã bật, bị chặn, chưa hỗ trợ.
- iOS chưa cài PWA hiển thị hướng dẫn "Chia sẻ > Thêm vào Màn hình chính".
- Khi đã bật, có nút gửi thông báo thử qua service worker.
- Hàng cài đặt chuyển thành bố cục dọc trên màn hình hẹp để công tắc và hướng dẫn không bị ép hoặc tràn.

## Kiểm thử

- Unit test phát hiện iOS/standalone và chuyển đổi VAPID key.
- API test/TypeScript kiểm tra payload và xác thực session.
- Browser test ở `412x915` (Android) và `390x844` (iPhone).
- Kiểm tra thực tế quyền thông báo trên Chromium local. iOS Safari thật vẫn cần kiểm tra trên thiết bị vì Chromium không mô phỏng Push API của WebKit.

