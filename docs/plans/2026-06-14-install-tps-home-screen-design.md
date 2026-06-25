# Thiết kế nút cài TPS vào Màn hình chính

## Mục tiêu

Thêm một nút cài TPS ngay trong phần Cài đặt thông báo để người dùng Android,
Chrome và Edge có thể mở hộp cài PWA bằng một lần bấm. Trên iPhone/iPad, nút
hiển thị hướng dẫn cài qua Safari vì iOS không cung cấp API cho website tự cài.

## Thiết kế

- Lắng nghe sự kiện `beforeinstallprompt` và giữ lại prompt cho tới khi người
  dùng bấm nút.
- Khi trình duyệt hỗ trợ, nút `Cài TPS vào màn hình chính` gọi prompt cài đặt
  chuẩn của trình duyệt.
- Khi ứng dụng chạy ở chế độ standalone hoặc nhận sự kiện `appinstalled`, hiển
  thị trạng thái `TPS đã được cài trên thiết bị này`.
- Trên iPhone/iPad chưa cài, nút mở hướng dẫn ba bước:
  Safari → Chia sẻ → Thêm vào Màn hình chính.
- Trên trình duyệt không phát sinh prompt, hiển thị hướng dẫn dùng menu trình
  duyệt thay vì báo cài thành công sai.

## Kiểm thử

- Unit test nhận diện trạng thái đã cài, iOS và khả năng mở prompt.
- TypeScript và ESLint.
- Kiểm tra responsive ở kích thước Android 412×915 và iPhone 390×844.

