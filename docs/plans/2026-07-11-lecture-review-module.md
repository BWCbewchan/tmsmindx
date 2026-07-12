# Module Duyệt Giảng Chuyên Môn

## Mục tiêu

TPS là hệ thống quản lý nghiệp vụ duyệt giảng: lập lịch, phân công hội đồng,
điểm danh, chấm rubric, nhận xét, công bố kết quả và lưu hồ sơ. Video không
được lưu lâu dài trong TPS để tránh quá tải dung lượng.

## Quyết Định Đã Chốt

- Đối tượng: ứng viên duyệt giảng lên giáo viên và giáo viên đang hoạt động.
- Mỗi hồ sơ có một vòng duyệt chính thức, nhưng được tạo yêu cầu duyệt lại không giới hạn số lần khi cần.
- Số lượng thành viên hội đồng do Teaching HO cấu hình theo từng buổi.
- Hình thức MVP: Google Meet; Teaching HO tạo link thủ công và gắn vào lịch.
- Video bắt buộc ghi hình, mọi người có quyền xem, thời hạn truy cập/lưu YouTube là 6 tháng.
- Kênh YouTube tổ chức sử dụng tài khoản `k12teaching@gmail.com`. OAuth token phải được lưu trong secret manager, không lưu trong source code hoặc database dạng plaintext.
- Kết quả tự công bố khi tất cả hội đồng viên được phân công đã hoàn tất chấm điểm.
- Điểm công bố được đồng bộ sang phần `Điểm duyệt giảng` của bảng đánh giá Tập huấn sư phạm.
- Consent, ẩn/khóa video và quy tắc xử lý khiếu nại được Teaching HO thiết lập thủ công.
- Báo cáo phải xem được theo ứng viên, cơ sở, hội đồng, đợt duyệt và tỷ lệ đạt.
- Chỉ TE Leader được tạo request cho giáo viên thuộc phạm vi quản lý.
- Teaching HO dùng thông tin setup lịch sự kiện làm nguồn lịch tuần.

## Phân vai

| Vai trò | Quyền chính |
| --- | --- |
| Quản trị/TPS | Tạo đợt duyệt, phân công hội đồng, quản lý rubric, công bố và khóa kết quả. |
| Leader | Gửi yêu cầu duyệt giảng cho giáo viên/ứng viên thuộc phạm vi quản lý, nêu lý do và mức ưu tiên. |
| Hội đồng chấm thi | Xem các buổi được phân công, vào phòng duyệt, chấm điểm, nhận xét và ký xác nhận. |
| Ứng viên/Giáo viên mới | Xem lịch của mình, tham gia buổi online, nộp tài liệu, xem video/nhận xét/kết quả đã công bố. |

Không dùng quyền admin chung cho hội đồng. Cần các permission độc lập:

- `lecture_review.view`
- `lecture_review.schedule`
- `lecture_review.request`
- `lecture_review.request.approve`
- `lecture_review.score`
- `lecture_review.publish_result`
- `lecture_review.participate`

## Vị trí Trong TPS

- Trang quản trị: module Duyệt giảng chuyên môn dành cho TPS và hội đồng.
- Candidate Portal: thêm mục `Duyệt Giảng` hoặc gộp trong `Lộ Trình Đào Tạo`.
- Không tạo thêm trang riêng ở khu giáo viên trong giai đoạn onboarding để tránh trùng luồng.

## Luồng Nghiệp Vụ

1. Leader tạo yêu cầu duyệt giảng: chọn ứng viên/giáo viên, lý do, mức ưu tiên, loại duyệt và khung thời gian mong muốn.
2. Teaching HO kiểm tra yêu cầu, xác nhận hoặc trả lại bổ sung thông tin.
3. Teaching HO lập lịch duyệt theo tuần, gom các yêu cầu đã xác nhận, phân công hội đồng và chọn thời lượng/phòng họp.
4. Hệ thống gửi thông báo, hiển thị lịch và yêu cầu chuẩn bị ở Candidate Portal.
5. Ứng viên và hội đồng tham gia phòng online đúng giờ.
6. Hội đồng chấm theo rubric, nhận xét theo tiêu chí hoặc theo mốc thời gian video.
7. Teaching HO khóa, công bố hoặc yêu cầu duyệt lại.
8. Ứng viên xem kết quả, nhận xét và video bản ghi nếu được phép.

## Điều Phối Lịch Tuần Của Teaching HO

Teaching HO là chủ sở hữu lịch, không phải Leader. Màn hình điều phối nên có tuần hiện tại/tuần kế tiếp, hàng đợi yêu cầu chưa xếp lịch và lịch theo hội đồng.

- Leader chỉ được đề xuất khung giờ; không tự chốt hoặc sửa lịch đã công bố.
- Teaching HO kéo yêu cầu vào một slot tuần, chỉ định hội đồng, link họp và thời lượng.
- Hệ thống kiểm tra trùng lịch ứng viên, Leader và hội đồng trước khi công bố.
- Mỗi thay đổi lịch sau khi công bố cần có lý do và gửi thông báo lại cho các bên.
- Khi hết tuần, các yêu cầu chưa xếp lịch được giữ lại trong hàng đợi để xếp tuần sau.

Nguồn dữ liệu lịch là module lịch sự kiện hiện có. Khi tạo slot duyệt giảng, Teaching HO chọn event/khung giờ hợp lệ từ lịch đó thay vì tự nhập lịch độc lập.

Trạng thái đề xuất: `draft`, `requested`, `needs_information`, `approved`, `scheduled`, `in_progress`, `reviewed`, `published`, `reschedule_requested`, `cancelled`.

## Rubric Và Cách Tính Điểm

Bộ rubric chính thức dùng tài liệu LEC mới: 25 tiêu chí, mỗi tiêu chí chấm thang 1-5. Trọng số hiện tại là đồng đều vì tài liệu chưa quy định trọng số riêng. Người chấm không bắt buộc nhận xét từng tiêu chí; chỉ cần nhận xét chung trước khi nộp.

### 1. Đánh Giá Sự Chuẩn Bị Của Giáo Viên

1. Chuẩn bị kế hoạch giảng dạy.
2. Xác định mục tiêu bài giảng.
3. Slide bài giảng.
4. Sử dụng phương tiện hỗ trợ, dụng cụ và sản phẩm mẫu.
5. Kiến thức công cụ.

### 2. Đánh Giá Năng Lực Áp Dụng Phương Pháp Giảng Dạy

6. Giáo viên diễn giải kiến thức.
7. Giáo viên mô phỏng kiến thức trên công cụ.
8. Kỹ thuật đặt câu hỏi kiểm tra kiến thức.
9. Cách thức tổ chức hoạt động lớp học.
10. Kết quả tổ chức hoạt động lớp học.
11. Hoạt động thực hành.
12. Cách thức tổ chức hoạt động thực hành.
13. Kết quả thực hành.
14. Hoạt động game hóa.
15. Kết quả game hóa.

### 3. Đánh Giá Kỹ Năng Sư Phạm Của Giáo Viên

16. Diễn đạt.
17. Tác phong sư phạm.
18. Phân bổ thời lượng.
19. Hệ thống khen thưởng.
20. Hệ thống tham gia và kiểm soát.
21. Hệ thống nhóm.
22. Hệ thống chú ý.
23. Xử lý tình huống sư phạm.
24. Quản lý lớp học.
25. Môi trường lớp học.

Cách tổng hợp đề xuất:

1. Điểm một hội đồng viên = trung bình 25 tiêu chí.
2. Điểm duyệt giảng cuối cùng = trung bình điểm của toàn bộ hội đồng viên đã nộp.
3. Hệ thống chỉ tự công bố khi số bài chấm hoàn tất bằng số hội đồng viên được phân công.

Thang mức điểm theo thông tin đã cung cấp:

| Mức | Điểm duyệt giảng |
| --- | --- |
| 1 | `< 3.6` |
| 2 | `3.6 - < 3.8` |
| 3 | `3.8 - < 4.0` |
| 4 | `4.0 - 4.4` |
| 5 | `> 4.4` |
| Không đạt | `<= 3.0` |

Điểm cần xác nhận trước khi code: điểm đúng bằng `3.0` đã là không đạt theo quy tắc trên; cần chốt điểm `4.4` thuộc mức 4 hay 5 để hệ thống hiển thị thống nhất.

## Thông Báo In-App

| Sự kiện | Người nhận | Nội dung chính |
| --- | --- | --- |
| Leader gửi request | Teaching HO | Có yêu cầu mới cần duyệt/xếp lịch. |
| Teaching HO yêu cầu bổ sung | TE Leader | Nội dung cần bổ sung cho request. |
| Lịch được công bố | Ứng viên/giáo viên, TE Leader, hội đồng | Thời gian, Google Meet, yêu cầu chuẩn bị. |
| Nhắc lịch | Các thành viên buổi duyệt | Nhắc trước 24 giờ và 30 phút. |
| Lịch thay đổi/hủy | Các thành viên buổi duyệt | Lý do và lịch thay thế nếu có. |
| Bản ghi sẵn sàng | Các thành viên buổi duyệt | Link video, hạn xem 6 tháng. |
| Đã đủ bài chấm | Teaching HO | Hệ thống sẵn sàng tự công bố. |
| Kết quả công bố | Ứng viên/giáo viên, TE Leader, hội đồng | Điểm cuối, mức đánh giá, nhận xét chung và yêu cầu duyệt lại nếu có. |

## Video Và YouTube

- File video đi qua hàng đợi xử lý, không giữ lâu trong TPS.
- Worker upload video lên YouTube Data API với trạng thái `Unlisted` mặc định.
- TPS chỉ lưu `youtube_video_id`, URL, thumbnail, thời lượng, trạng thái upload và log lỗi.
- Có retry, trạng thái `queued/uploading/ready/failed` và cảnh báo khi upload thất bại.
- Cần consent cho người xuất hiện trong video; `Unlisted` không phù hợp với dữ liệu yêu cầu bảo mật tuyệt đối.

## Phạm Vi MVP

1. Tạo buổi duyệt và phân công hội đồng/ứng viên.
2. Candidate Portal hiển thị lịch, trạng thái và nút tham gia.
3. Dùng Google Meet hoặc Zoom link do TPS quản lý.
4. Rubric, điểm, nhận xét, đính kèm tài liệu và công bố kết quả.
5. Upload bản ghi sang YouTube `Unlisted`, lưu link và trạng thái trong TPS.

Tích hợp phòng họp trực tiếp LiveKit/WebRTC chỉ nên làm sau khi quy trình MVP ổn định.

## Dữ Liệu Dự Kiến

- `lecture_review_cycles`: đợt duyệt giảng.
- `lecture_review_sessions`: buổi duyệt, lịch, link họp, trạng thái, video.
- `lecture_review_requests`: yêu cầu từ Leader, lý do, mức ưu tiên, khung giờ đề xuất và lịch sử phê duyệt.
- `lecture_review_panelists`: thành viên hội đồng và quyền trong buổi.
- `lecture_review_rubrics` và `lecture_review_scores`: tiêu chí và điểm chấm.
- `lecture_review_feedback`: nhận xét, mốc thời gian video, phản hồi ứng viên.
- `lecture_review_attendance`: thời điểm vào/rời buổi online.
- `lecture_review_video_jobs`: hàng đợi upload YouTube và lịch sử lỗi.

## Thông Tin Cần Chốt

1. Xác nhận ranh điểm `4.4` thuộc mức 4 hay mức 5.
2. Chốt quy tắc duyệt lại: cùng rubric hay rubric riêng, có giữ điểm/vídeo các lần trước không.
3. Xác định event nào trong module lịch sự kiện là nguồn slot duyệt giảng và ai được phép sửa slot.
4. Xác định người nhận video "Ai cũng được xem": toàn hệ thống, hay toàn bộ người có tài khoản TPS.
5. Cung cấp Google Meet workflow: Teaching HO tạo lịch bằng tài khoản nào và cách lưu link thủ công.
6. Thiết lập OAuth YouTube cho `k12teaching@gmail.com`, quota owner và nơi lưu secret/token an toàn.
7. Cung cấp nội dung/biểu mẫu consent và quy tắc xử lý khiếu nại để Teaching HO cấu hình.
