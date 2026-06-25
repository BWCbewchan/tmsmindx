# Thiết kế đánh giá bộ đề sau bài kiểm tra

## Mục tiêu

Sau khi mentor hoàn thành bài kiểm tra chuyên môn, hệ thống cho phép gửi đánh giá tùy chọn về bộ đề. Admin xem được thống kê rating, nội dung feedback và cập nhật trạng thái xử lý ngay trong trang `/admin/thu-vien-de`.

## Quyết định sản phẩm

- Đánh giá không bắt buộc; mentor có thể bỏ qua.
- Một lần làm bài chỉ có một đánh giá.
- Mentor có thể chỉnh sửa khi đánh giá còn ở trạng thái `new`.
- Rating từ 1 đến 5 sao là tùy chọn.
- Một form chứa đồng thời hai nhóm:
  - Feedback hệ thống: giao diện, lỗi, lag, chậm.
  - Feedback chuyên môn: câu sai, thiếu hình ảnh, đáp án hoặc nội dung chưa phù hợp.
- Feedback chuyên môn có thể chọn nhiều câu hỏi hoặc góp ý chung cho cả đề.
- Admin xử lý theo luồng `new -> in_progress -> done`.

## Kiến trúc dữ liệu

Tạo bảng `exam_feedback_reviews` gắn trực tiếp với `chuyen_sau_results.id`, vì đây là mã đại diện cho một lần đăng ký/làm bài trong luồng hiện tại.

Các trường chính:

- `result_id`: duy nhất, đảm bảo một đánh giá cho một lần làm bài.
- `set_id`, `set_code`, `set_name`: liên kết và snapshot bộ đề.
- `subject_code`, `subject_name`: snapshot môn để báo cáo ổn định.
- `reviewer_email`, `reviewer_code`, `reviewer_name`.
- `rating`: 1-5, có thể để trống.
- `system_comment`, `subject_comment`.
- `status`: `new`, `in_progress`, `done`.
- `handled_by_email`, `handled_at`, timestamps.

Tạo bảng con `exam_feedback_review_questions` để liên kết nhiều câu hỏi với một feedback chuyên môn. Bảng lưu `question_id`, thứ tự câu và snapshot nội dung để báo cáo vẫn đọc được nếu câu hỏi được chỉnh sửa sau đó.

Ràng buộc:

- Phải có ít nhất một trong ba nội dung: rating, feedback hệ thống hoặc feedback chuyên môn.
- Câu hỏi được chọn phải thuộc đúng bộ đề của lần làm bài.
- Chỉ chủ sở hữu `chuyen_sau_results` được tạo hoặc sửa đánh giá.
- Chỉ cho gửi sau khi bài đã ở trạng thái hoàn thành.
- Chỉ admin/super admin được đọc toàn bộ thống kê và đổi trạng thái.

## API

### API mentor

`GET /api/exam-feedback?result_id=...`

- Kiểm tra quyền sở hữu.
- Trả đánh giá hiện tại và danh sách câu hỏi có thể chọn.

`POST /api/exam-feedback`

- Tạo đánh giá mới.
- Xác thực cùng nguồn, phiên đăng nhập, quyền sở hữu, trạng thái bài thi và dữ liệu nhập.

`PUT /api/exam-feedback`

- Cập nhật đánh giá khi trạng thái còn `new`.
- Thay thế danh sách câu hỏi được chọn trong một transaction.

### API admin

`GET /api/exam-feedback/admin`

- Bộ lọc: tháng làm bài, môn, bộ đề, trạng thái, loại feedback và từ khóa mentor.
- Trả KPI, phân bố rating và danh sách chi tiết có phân trang.

`PATCH /api/exam-feedback/admin`

- Chuyển trạng thái theo đúng thứ tự `new -> in_progress -> done`.
- Ghi người xử lý và thời điểm hoàn thành.

## Giao diện mentor

Tạo component dùng chung `ExamFeedbackForm`.

Trên màn hình hoàn thành:

- Hiển thị khối “Đánh giá bộ đề” dưới điểm số.
- Chọn 1-5 sao bằng nút có trạng thái hover/focus rõ ràng.
- Hai textarea riêng cho feedback hệ thống và chuyên môn.
- Khi nhập feedback chuyên môn, hiển thị danh sách câu hỏi để chọn nhiều câu.
- Nút “Gửi đánh giá”; liên kết quay lại danh sách luôn khả dụng để bỏ qua.

Trong danh sách bài đã hoàn thành:

- Có nút “Đánh giá bộ đề” nếu chưa gửi.
- Có nút “Chỉnh sửa đánh giá” khi trạng thái còn `new`.
- Khi admin đã nhận xử lý, hiển thị trạng thái và không cho sửa.

## Giao diện admin

Thêm tab cấp trang “Thống kê đánh giá” tại `/admin/thu-vien-de`.

Tab gồm:

- KPI: tổng đánh giá, rating trung bình, số feedback hệ thống, số feedback chuyên môn, số chưa xử lý.
- Phân bố 1-5 sao.
- Bộ lọc theo tháng, môn, bộ đề, trạng thái, loại feedback và từ khóa.
- Bảng chi tiết: mentor, thời gian làm bài, môn/bộ đề, rating, loại feedback, câu liên quan, nội dung và trạng thái.
- Nút chuyển trạng thái hợp lệ trên từng dòng.

## Xử lý lỗi

- API trả thông báo tiếng Việt cho lỗi dữ liệu và quyền truy cập.
- Form giữ nguyên dữ liệu khi gửi thất bại.
- Chặn gửi lặp trong lúc request đang chạy.
- Không làm lỗi màn hình kết quả nếu API feedback tạm thời không khả dụng.
- Admin có trạng thái loading, empty và retry rõ ràng.

## Kiểm thử

- Unit test validation rating, nội dung trống, chuẩn hóa question IDs và chuyển trạng thái.
- API được kiểm tra bằng TypeScript build/lint và truy vấn sử dụng parameter binding.
- Kiểm tra thủ công:
  - Gửi rating-only.
  - Gửi đồng thời hai loại feedback.
  - Chọn nhiều câu hỏi.
  - Sửa khi `new`, bị chặn khi `in_progress`.
  - Lọc và chuyển trạng thái trong tab admin.
  - Responsive trên desktop và mobile.
