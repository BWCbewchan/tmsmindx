# Multi Email Account Routing Design

## Mục tiêu

Mở rộng màn hình Giám sát Email để Super Admin quản lý nhiều tài khoản Gmail, theo dõi riêng quota `To` và `CC`, và phân phối thư theo vòng tròn ổn định khi hệ thống chạy nhiều tiến trình.

## Kiến trúc

- Hai tài khoản gốc đọc credential từ `.env`. Database chỉ giữ metadata, trạng thái, quota và thứ tự luân phiên; không sao chép mật khẩu env vào database.
- Tài khoản do Super Admin thêm được lưu trong database. App Password được mã hóa AES-256-GCM bằng `EMAIL_CREDENTIAL_ENCRYPTION_KEY`.
- Mỗi lần gửi, một transaction khóa duy nhất bản ghi trạng thái định tuyến bằng `SELECT ... FOR UPDATE`, chọn tài khoản active tiếp theo theo thứ tự, cập nhật con trỏ rồi commit.
- Nếu tài khoản được chọn lỗi gửi, hệ thống ghi log đúng tài khoản. Không tự gửi lại qua tài khoản khác để tránh gửi trùng khi nhà cung cấp đã nhận thư nhưng phản hồi bị gián đoạn.
- Quota là ngưỡng vận hành do hệ thống tự đếm trong 24 giờ; Gmail SMTP không cung cấp API quota còn lại.

## Dữ liệu

`email_sender_accounts` lưu email, tên hiển thị, nguồn `env` hoặc `database`, credential mã hóa cho tài khoản database, quota `To`, quota `CC`, trạng thái active, thứ tự và lần sử dụng cuối.

`email_sender_routing_state` giữ con trỏ round-robin. `email_delivery_logs` bổ sung `sender_account_id`, `to_recipient_count` và `cc_recipient_count`.

## API và bảo mật

- API Giám sát Email tiếp tục chỉ dành cho `super_admin`.
- GET trả danh sách tài khoản cùng số lượng `To`/`CC` đã dùng trong 24 giờ.
- POST hỗ trợ thêm tài khoản, kiểm tra kết nối từng tài khoản và gửi thư thử.
- PATCH hỗ trợ bật/tắt và chỉnh quota riêng.
- DELETE chỉ xóa tài khoản database; tài khoản env chỉ có thể tắt.
- API không bao giờ trả credential đã mã hóa hay App Password.

## Giao diện

- Dùng `@/lib/app-toast` để đồng bộ toast toàn hệ thống.
- Dùng lại `Button`, `Card`, `Dialog`, `Input`, `Label`, `Badge`, `Table` và skeleton hiện có.
- Mỗi tài khoản là một card có hai thanh quota `To` và `CC`, trạng thái, nguồn, lượt gửi gần nhất và các thao tác.
- Không tạo thêm component UI mới; chỉ mở rộng trang hiện tại.

## Kiểm thử

- Unit test mã hóa/giải mã và lựa chọn vòng tròn.
- API test thực tế với cookie Super Admin cho GET và các validation không gây gửi mail.
- TypeScript, ESLint, test và production build.
