# Email Quota Monitor Design

## Mục tiêu

Tạo màn hình `Giám sát Email` trong `Cấu Hình Hệ Thống`, chỉ Super Admin được truy cập. Màn hình phải giúp xác định nhanh hệ thống email đang hoạt động tốt, chậm, lỗi cấu hình hay chạm giới hạn nhà cung cấp.

## Phạm vi

- Ghi nhận mọi lần gửi qua mail transporter chung của ứng dụng.
- Không lưu nội dung HTML hoặc nội dung riêng tư của email.
- Lưu trạng thái, người nhận, tiêu đề, nguồn gọi, thời gian xử lý, mã lỗi và thông tin phản hồi SMTP.
- Theo dõi theo thời gian thực bằng cách tải lại dữ liệu mỗi 15 giây.
- Chỉ Super Admin được xem API và giao diện.

## Kiến trúc

### Dữ liệu

`email_delivery_logs` lưu từng lần gửi:

- thời điểm bắt đầu/kết thúc;
- trạng thái `sent`, `failed`, `skipped`;
- địa chỉ gửi, danh sách To/CC và tổng số người nhận;
- tiêu đề, loại email và nguồn gọi;
- độ trễ;
- mã lỗi, nhóm lỗi, thông báo lỗi;
- message id và SMTP response nếu có.

`email_monitor_settings` lưu một bản ghi cấu hình ngưỡng:

- hạn mức thư trong 24 giờ;
- hạn mức người nhận trong 24 giờ;
- ngưỡng cảnh báo phần trăm;
- ngưỡng độ trễ;
- ngưỡng tỷ lệ lỗi;
- thời gian lưu log.

### Ghi log

`sendMail` đo thời gian và ghi log sau mỗi kết quả gửi. Nếu ghi log thất bại, việc gửi mail vẫn trả kết quả bình thường. Nếu Gmail chưa cấu hình, hệ thống ghi trạng thái `skipped` với nhóm lỗi cấu hình.

### API

- `GET /api/admin/email-monitor`: trả tổng quan, chuỗi thời gian, phân loại lỗi, nguồn gửi và danh sách log có lọc/phân trang.
- `PATCH /api/admin/email-monitor`: cập nhật ngưỡng cảnh báo.
- `DELETE /api/admin/email-monitor`: dọn log cũ theo thời gian lưu.

Tất cả phương thức đều kiểm tra role `super_admin` từ database.

## Giao diện

Màn hình gồm:

1. Trạng thái tổng thể và chẩn đoán nổi bật.
2. Các chỉ số 24 giờ: thư, người nhận, tỷ lệ thành công, độ trễ trung bình/P95, tải giờ cao điểm.
3. Thanh quota vận hành cho thư và người nhận.
4. Biểu đồ tải theo giờ và lịch sử 7 ngày.
5. Phân bổ trạng thái, nhóm lỗi và nguồn gửi.
6. Bảng log chi tiết với bộ lọc trạng thái, khoảng thời gian, từ khóa và phân trang.
7. Khung kiểm tra cấu hình Gmail, secret nội bộ và kết nối database.
8. Cấu hình ngưỡng cảnh báo và chức năng dọn log.

## Trạng thái sức khỏe

- `Tốt`: tỷ lệ lỗi và độ trễ dưới ngưỡng, quota dưới mức cảnh báo.
- `Cảnh báo`: ít nhất một ngưỡng cảnh báo bị vượt.
- `Nghiêm trọng`: Gmail chưa cấu hình, tỷ lệ lỗi cao gấp đôi ngưỡng, hoặc quota đạt 100%.
- `Không có dữ liệu`: chưa ghi nhận lần gửi nào trong cửa sổ 24 giờ.

## Bảo mật và riêng tư

- API không dựa vào role lưu phía trình duyệt.
- Không trả dữ liệu cho admin/manager thường.
- Không lưu body email.
- Mật khẩu Gmail và secret không bao giờ được trả về; chỉ trả cờ đã cấu hình.
- Thông báo lỗi được giới hạn độ dài trước khi lưu.

## Kiểm thử

- Unit test phân loại lỗi và tính trạng thái sức khỏe.
- TypeScript/lint cho các file thay đổi.
- Build ứng dụng.
- Mở màn hình trên trình duyệt và kiểm tra giao diện desktop/mobile.

