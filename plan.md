# Kế Hoạch: Module Duyệt Giảng Chuyên Môn

## Mục Tiêu

Xây dựng module Duyệt Giảng Chuyên Môn trong TPS để quản lý quy trình tạo yêu cầu, xếp lịch, phân công hội đồng, chấm rubric, công bố kết quả và đồng bộ điểm về bảng Tập Huấn Sư Phạm.

Hệ thống sẽ được triển khai theo 2 phase:

- Phase 1: MVP nghiệp vụ cốt lõi, ưu tiên chạy được quy trình end-to-end trong TPS.
- Phase 2: Video, bảo mật, thông báo và báo cáo nâng cao.

## Nền Tảng Hiện Có Trong TPS

Repo hiện đã có một phần nền cho quy trình duyệt giảng:

- `event_schedules` đã có loại sự kiện `teaching_review`.
- `lecture_review_registrations` đã lưu đăng ký/yêu cầu cơ bản theo sự kiện và mã giáo viên.
- `lecture_reviewer_meetings` đã lưu meeting link theo reviewer.
- Màn hình lịch đánh giá đã có điểm neo cho lịch `Duyệt giảng chuyên môn`.
- Bảng `Tập Huấn Sư Phạm` đã có cột `Điểm Duyệt giảng 70%`, `Điểm Lý thuyết 30%`, `Total Score`.

Khoảng trống lớn hiện tại:

- Chưa có hàng đợi yêu cầu chính thức cho Leader và Teaching HO.
- Chưa có session/rubric/panelist score đúng nghiệp vụ hội đồng.
- Chưa có điểm duyệt giảng chính thức để đồng bộ về bảng Tập Huấn Sư Phạm.
- Chưa có workflow công bố kết quả, lịch sử duyệt lại, video job và consent.

## Phase 1: MVP Nghiệp Vụ Duyệt Giảng

### Mục Tiêu Phase 1

Hoàn thiện luồng nghiệp vụ cốt lõi:

Leader tạo yêu cầu -> Teaching HO duyệt/xếp lịch -> gán hội đồng -> ứng viên/giáo viên xem lịch -> hội đồng chấm rubric -> hệ thống tính điểm -> công bố kết quả -> đồng bộ điểm về Tập Huấn Sư Phạm.

Phase 1 chưa tự động upload YouTube. Nếu có video, Teaching HO dán link thủ công.

### Phạm Vi Phase 1

1. Module quản trị Duyệt Giảng Chuyên Môn

- Tạo trang quản trị riêng cho Teaching HO/TPS.
- Có các tab chính:
  - Yêu cầu chờ xử lý
  - Lịch duyệt giảng
  - Hội đồng chấm
  - Kết quả
  - Cấu hình rubric

2. Leader tạo yêu cầu duyệt giảng

- Leader chọn ứng viên/giáo viên thuộc phạm vi quản lý.
- Nhập lý do, mức ưu tiên, loại duyệt, lesson/slide duyệt, khung thời gian mong muốn.
- Hệ thống chặn Leader tạo request ngoài phạm vi quản lý.
- Trạng thái yêu cầu ban đầu: `requested`.

3. Teaching HO xử lý yêu cầu

- Xem hàng đợi yêu cầu.
- Duyệt yêu cầu hoặc trả về để bổ sung thông tin.
- Trạng thái đề xuất:
  - `requested`
  - `needs_information`
  - `approved`
  - `cancelled`

4. Xếp lịch duyệt giảng

- Teaching HO chọn slot từ lịch sự kiện `event_schedules` loại `teaching_review`.
- Gắn Google Meet link thủ công.
- Gắn thời lượng, phòng/link họp, hội đồng chấm.
- Kiểm tra trùng lịch ứng viên/giáo viên, Leader và hội đồng trước khi công bố.
- Trạng thái sau khi xếp lịch: `scheduled`.

5. Candidate Portal

- Thêm mục `Duyệt Giảng` hoặc hiển thị trong `Lộ Trình Đào Tạo`.
- Ứng viên/giáo viên xem:
  - thời gian
  - Google Meet link
  - lesson/slide cần chuẩn bị
  - hội đồng/reviewer nếu được phép hiển thị
  - trạng thái buổi duyệt
  - kết quả sau khi công bố

6. Hội đồng chấm rubric

- Rubric gồm 25 tiêu chí, thang 1-5.
- Mỗi hội đồng viên chấm độc lập.
- Bắt buộc nhập nhận xét chung trước khi nộp.
- Không bắt buộc nhận xét từng tiêu chí trong MVP.
- Điểm một hội đồng viên = trung bình 25 tiêu chí.

### Rubric Chính Thức LEC

Nguồn rubric: file `[MindX] - Đào tạo đầu vào [ Private for HO] - Tiêu chí duyệt giảng[LEC].csv`.

Thang điểm chính thức:

- 1: Chưa thể hiện
- 2: Thấp
- 3: Trung Bình
- 4: Cao
- 5: Xuất sắc

Khi triển khai, cần seed đầy đủ các trường từ file CSV vào database:

- `criteria_order`: số thứ tự tiêu chí.
- `criteria_group`: nhóm tiêu chí.
- `criteria_name`: nội dung đánh giá.
- `learning_outcome`: yêu cầu đầu ra (LOs).
- `level_1_description`: mô tả mức Chưa thể hiện.
- `level_2_description`: mô tả mức Thấp.
- `level_3_description`: mô tả mức Trung Bình.
- `level_4_description`: mô tả mức Cao.
- `level_5_description`: mô tả mức Xuất sắc.

Danh sách 25 tiêu chí chính thức:

#### Nhóm 1: Đánh Giá Sự Chuẩn Bị Của Giáo Viên

1. Chuẩn bị kế hoạch giảng dạy
   - Yêu cầu đầu ra: giáo viên trình bày được học liệu/học cụ đã chuẩn bị, tình trạng dự thính lớp thực tế, góp ý từ Leader/Fulltime/Trainer, học phần, bài học, kiến thức học, độ tuổi học sinh, nội dung dạy thử, cách sắp xếp bài giảng và tiêu chí đo lường đầu ra.
2. Xác định mục tiêu bài giảng
   - Yêu cầu đầu ra: giáo viên biết được nội dung đầu ra của nội dung giảng dạy.
3. Slide bài giảng
   - Yêu cầu đầu ra: chuẩn bị slide giảng dạy trực quan.
4. Sử Dụng Phương Tiện Hỗ Trợ, Dụng Cụ, Sản Phẩm Mẫu
   - Yêu cầu đầu ra: biết cách sử dụng phương tiện hỗ trợ, dụng cụ, sản phẩm mẫu phục vụ cho công tác giảng dạy.
5. Kiến Thức Công Cụ
   - Yêu cầu đầu ra: nắm được kiến thức công cụ trong quá trình giảng dạy, hiểu công cụ dùng để làm gì và tại sao học sinh nên học với công cụ đó.

#### Nhóm 2: Đánh Giá Năng Lực Áp Dụng Phương Pháp Giảng Dạy

6. Giáo Viên Diễn Giải Kiến Thức
   - Yêu cầu đầu ra: giáo viên có thể diễn giải kiến thức theo mô hình 5W1H/5H1W.
7. Giáo Viên Mô Phỏng Kiến Thức Trên Công Cụ
   - Yêu cầu đầu ra: sử dụng linh hoạt công cụ giảng dạy để tạo cảm giác trực quan cho học viên trong hoạt động học kiến thức mới.
8. Kỹ Thuật Đặt Câu Hỏi Kiểm Tra Kiến Thức
   - Yêu cầu đầu ra: đặt câu hỏi để kiểm tra kiến thức học viên sau mỗi giai đoạn bài dạy, đảm bảo học viên đã hiểu và chú tâm vào bài học.
9. Cách Thức Tổ Chức Hoạt Động Lớp Học
   - Yêu cầu đầu ra: tạo các hoạt động dẫn dắt kiến thức theo mục tiêu trong từng giai đoạn bài học.
10. Kết Quả Tổ Chức Hoạt Động Lớp Học
    - Yêu cầu đầu ra: giáo viên nắm được kết quả đầu ra kiến thức sau khi tổ chức hoạt động lớp học.
11. Hoạt Động Thực Hành
    - Yêu cầu đầu ra: tạo các nhiệm vụ thực hành cụ thể, áp dụng phương pháp phân tầng năng lực để vừa thực hành vừa đánh giá năng lực học viên.
12. Cách Thức Tổ Chức Hoạt Động Thực Hành
    - Yêu cầu đầu ra: bao quát học viên trong giai đoạn thực hành, phân biệt và hỗ trợ học sinh chưa nắm kỹ bài, khuyến khích và tạo động lực cho học viên đã có năng lực.
13. Kết Quả Thực Hành
    - Yêu cầu đầu ra: đánh giá được mức độ hoàn thành và năng lực của học sinh sau hoạt động thực hành.
14. Hoạt Động Game Hoá
    - Yêu cầu đầu ra: tổ chức mục tiêu học thành trò chơi để học sinh thoải mái tiếp cận kiến thức, chủ động học tập và cạnh tranh lành mạnh.
15. Kết Quả Game Hoá
    - Yêu cầu đầu ra: đánh giá hiệu quả hoạt động game hóa dựa trên tính cạnh tranh, tính giải trí, mức độ hào hứng và khả năng giáo viên tổng kết kiến thức qua game hóa.

#### Nhóm 3: Đánh Giá Kỹ Năng Sư Phạm Của Giáo Viên

16. Diễn Đạt
    - Yêu cầu đầu ra: diễn đạt lưu loát, dễ hiểu, tạo được tinh thần học tập cho học sinh.
17. Tác Phong Sư Phạm
    - Yêu cầu đầu ra: thể hiện phong thái truyền đạt, giọng điệu truyền cảm và khí chất nhà giáo.
18. Phân Bổ Thời Lượng
    - Yêu cầu đầu ra: phân bổ và kiểm soát được thời gian hoàn thành các giai đoạn buổi học.
19. Hệ Thống Khen Thưởng
    - Yêu cầu đầu ra: biết cách khuyến khích, động viên học sinh, tạo tinh thần học tập sôi nổi cho lớp học.
20. Hệ Thống Tham Gia Và Kiểm Soát
    - Yêu cầu đầu ra: đánh giá, kiểm tra liên tục, kiểm soát rủi ro trong quá trình học tập và linh hoạt tạo điều kiện cho học sinh.
21. Hệ Thống Nhóm
    - Yêu cầu đầu ra: đảm bảo học sinh có thể hoạt động cùng nhau qua các dạng nhóm như phân tầng năng lực, xen kẽ năng lực và linh hoạt thay đổi.
22. Hệ Thống Chú Ý
    - Yêu cầu đầu ra: đảm bảo học sinh chú ý, theo dõi trong quá trình học tập và phù hợp với bối cảnh học tập.
23. Xử Lý Tình Huống Sư Phạm
    - Yêu cầu đầu ra: nhận biết, tự chủ xử lý và phòng tránh rủi ro trong quá trình giảng dạy.
24. Quản Lý Lớp Học
    - Yêu cầu đầu ra: bao quát, chủ động, nhất quán và quyết đoán trong quá trình quản lý lớp học.
25. Môi Trường Lớp Học
    - Yêu cầu đầu ra: đảm bảo môi trường học tập vui vẻ, sôi nổi nhưng vẫn có kỷ luật và tuân thủ nội quy học tập.

Quy tắc tính điểm rubric trong Phase 1:

- Mỗi tiêu chí có điểm nguyên từ 1 đến 5.
- Điểm một hội đồng viên = trung bình cộng của 25 tiêu chí.
- Trọng số giữa các tiêu chí mặc định đồng đều theo file LEC hiện tại.
- Nếu sau này có trọng số riêng, cần thêm cột `weight` vào rubric và cập nhật công thức tính điểm.

7. Tính điểm và công bố

- Điểm rubric nội bộ của một hội đồng viên = trung bình 25 tiêu chí.
- Điểm duyệt giảng thô của một buổi = trung bình điểm của tất cả hội đồng viên đã nộp.
- Hệ thống chỉ sẵn sàng công bố khi số bài chấm hoàn tất bằng số hội đồng được phân công.
- Kết quả có thể được tự động công bố hoặc Teaching HO bấm công bố, tùy quyết định cấu hình.
- Sau khi công bố, điểm duyệt giảng được dùng làm nguồn cho cột `Điểm Duyệt giảng 70%` của bảng `Tập Huấn Sư Phạm`.

### Quy Tắc Tính Điểm Tập Huấn Sư Phạm

Các quy tắc dưới đây thay thế logic suy đoán từ điểm trung bình Lesson 1-4. Khi triển khai TPS, cần mô phỏng đúng logic Sheet hiện tại.

1. Điểm lý thuyết 30%

- Nguồn điểm: quiz đánh giá sư phạm 60 câu trong bộ đề.
- Tương đương Sheet hiện tại: `Lesson 5 (LT)`.
- Key lookup: mã giáo viên/ứng viên tại cột `B` của bảng Tập Huấn Sư Phạm.
- Cách lookup trong Sheet:
  - Tìm mã ở `Lesson 5 (LT)!G:G`.
  - Lấy điểm trả về từ `Lesson 5 (LT)!D:D`.
  - Dùng kết quả khớp mới nhất nếu có nhiều dòng trùng mã, tương đương `XLOOKUP(...; 0; -1)`.
- Quy tắc hiển thị:
  - Nếu mã ở cột `B` trống thì để trống.
  - Nếu không tìm thấy điểm, lỗi lookup hoặc điểm không phải số thì trả `3T`.
  - Nếu điểm lý thuyết `> 4.99` thì lấy điểm đó.
  - Nếu điểm lý thuyết `<= 4.99` thì trả `3T`.
- Công thức Sheet tham chiếu:

```text
=IF(B5="";;IFERROR(IF(
XLOOKUP(B5;'Lesson 5 (LT)'!$G$1:$G;'Lesson 5 (LT)'!$D$1:$D;;0;-1)>4,99;XLOOKUP(B5;'Lesson 5 (LT)'!$G$1:$G;'Lesson 5 (LT)'!$D$1:$D;;0;-1);"3T");"3T"))
```

2. Điểm duyệt giảng 70%

- Nguồn điểm: kết quả duyệt giảng đã công bố.
- Tương đương Sheet hiện tại: `Lesson 5 (duyệt giảng)`.
- Key lookup: mã giáo viên/ứng viên tại cột `B` của bảng Tập Huấn Sư Phạm.
- Cách lookup trong Sheet:
  - Tìm mã ở `Lesson 5 (duyệt giảng)!G:G`.
  - Lấy điểm trả về từ `Lesson 5 (duyệt giảng)!I:I`.
  - Dùng kết quả khớp mới nhất nếu có nhiều dòng trùng mã, tương đương `XLOOKUP(...; 0; -1)`.
- Quy tắc hiển thị:
  - Nếu mã ở cột `B` trống thì để trống.
  - Nếu không tìm thấy điểm, lỗi lookup hoặc điểm không phải số thì trả `3T`.
  - Nếu điểm duyệt giảng `> 5.99` thì lấy điểm đó.
  - Nếu điểm duyệt giảng `<= 5.99` thì trả `3T`.
- Công thức Sheet tham chiếu:

```text
=IF(B5="";;IFERROR(IF(
XLOOKUP(B5;'Lesson 5 (duyệt giảng)'!$G$1:$G;'Lesson 5 (duyệt giảng)'!$I$1:$I;;0;-1)>5,99;XLOOKUP(B5;'Lesson 5 (duyệt giảng)'!$G$1:$G;'Lesson 5 (duyệt giảng)'!$I$1:$I;;0;-1);"3T");"3T"))
```

3. Total Score

- Nếu `Điểm duyệt giảng 70%` và `Điểm lý thuyết 30%` đều là số:

```text
Total Score = Điểm duyệt giảng * 0.7 + Điểm lý thuyết * 0.3
```

- Nếu một trong hai điểm là `3T`, trống hoặc lỗi thì `Total Score = 3T`.
- Công thức Sheet tham chiếu:

```text
=ArrayFormula(IFERROR(K5:K*0,7+L5:L*0,3;"3T"))
```

4. Trạng thái tập huấn

- Nếu `Total Score = 3T` thì trạng thái là `Chưa hoàn thành tập huấn`.
- Nếu `Total Score` là số và `> 5.99` thì trạng thái là `Đã hoàn thành tập huấn`.
- Nếu `Total Score` là số và `<= 5.99` thì trạng thái là `Chưa hoàn thành tập huấn`.
- Nếu sau này cần giữ override thủ công giống công thức Sheet cũ, cần thêm trường override riêng để Teaching HO cập nhật có audit log.

8. Lịch sử duyệt lại cơ bản

- Cho phép tạo yêu cầu duyệt lại không giới hạn.
- Mỗi lần duyệt lại tạo một attempt/cycle mới.
- Giữ lịch sử điểm, reviewer, nhận xét, ngày công bố của các lần trước.

### Dữ Liệu Cần Thêm Trong Phase 1

Các bảng đề xuất:

- `lecture_review_cycles`: đợt/vòng duyệt hoặc attempt.
- `lecture_review_requests`: yêu cầu từ Leader.
- `lecture_review_sessions`: buổi duyệt đã xếp lịch.
- `lecture_review_panelists`: hội đồng được gán vào buổi.
- `lecture_review_rubrics`: bộ tiêu chí rubric.
- `lecture_review_scores`: điểm từng tiêu chí của từng hội đồng viên.
- `lecture_review_results`: điểm tổng hợp và trạng thái công bố.
- `lecture_review_feedback`: nhận xét chung và phản hồi.
- `lecture_review_result_syncs`: lịch sử đồng bộ điểm duyệt giảng sang bảng Tập Huấn Sư Phạm.

Có thể giữ `lecture_review_registrations` hiện tại làm nguồn đăng ký cũ, nhưng nên chuẩn hóa dần sang request/session mới để đúng nghiệp vụ.

Điểm lý thuyết 30% không thuộc module duyệt giảng. Nguồn điểm này cần đọc từ bài quiz đánh giá sư phạm 60 câu trong bộ đề, ưu tiên dùng dữ liệu bài làm mới nhất theo mã giáo viên/ứng viên.

### Permission Phase 1

Cần thêm các permission hành động hoặc route tương ứng:

- `lecture_review.view`
- `lecture_review.request`
- `lecture_review.request.approve`
- `lecture_review.schedule`
- `lecture_review.score`
- `lecture_review.publish_result`
- `lecture_review.participate`

Nếu hệ permission hiện tại chỉ quản lý theo route, Phase 1 có thể map tạm bằng route permission, sau đó tách action permission ở Phase 2.

### Cần Chuẩn Bị Trước Phase 1

1. Chốt quy tắc điểm

- `3.0` có phải là không đạt.
- `4.4` thuộc mức 4 hay mức 5.
- Xác nhận ngưỡng lấy điểm lý thuyết là `> 4.99`.
- Xác nhận ngưỡng lấy điểm duyệt giảng là `> 5.99`.
- Xác nhận ngưỡng hoàn thành tập huấn dựa trên `Total Score > 5.99`.
- Kết quả hiển thị theo mức điểm hay chỉ Đạt/Không đạt.
- Xác nhận bài quiz lý thuyết sư phạm 60 câu chính thức trong thư viện bộ đề.
- Xác nhận khi một giáo viên có nhiều lần làm quiz/duyệt giảng thì luôn lấy bản mới nhất theo mã.

2. Xác nhận và cấu hình rubric

- Xác nhận sử dụng bộ rubric LEC trong file CSV làm bản chính thức.
- Xác nhận giữ nguyên tên tiêu chí, nhóm tiêu chí và mô tả thang điểm 1-5 từ file CSV.
- Có bắt buộc nhận xét chung không.
- Có cần nhận xét theo tiêu chí không.
- Có cho phép Teaching HO chỉnh sửa rubric sau khi đã có bài chấm không.

3. Chốt vai trò và phạm vi

- Ai là Teaching HO.
- Ai là TE Leader.
- Ai là hội đồng chấm.
- Mapping Leader quản lý giáo viên theo cơ sở/khu vực/khối.
- Hội đồng có giới hạn theo khối/môn/cơ sở không.

4. Chốt lịch và Google Meet

- Teaching HO tạo Google Meet bằng tài khoản nào.
- Link Meet được nhập thủ công vào đâu.
- Ai được sửa link sau khi lịch đã công bố.
- Đổi lịch có bắt buộc nhập lý do hay không.

5. Chốt nội dung portal

- Ứng viên/giáo viên được xem những thông tin nào.
- Có hiển thị tên hội đồng không.
- Có hiển thị nhận xét nội bộ không.
- Kết quả công bố gồm điểm, mức, nhận xét hay thêm đề xuất duyệt lại.

### Kết Quả Kỳ Vọng Sau Phase 1

- Teaching HO có thể vận hành lịch duyệt giảng trong TPS.
- Leader có thể tạo yêu cầu đúng phạm vi.
- Hội đồng chấm điểm trên TPS.
- Điểm duyệt giảng được đồng bộ về bảng Tập Huấn Sư Phạm.
- Candidate Portal hiển thị lịch và kết quả cho ứng viên/giáo viên.

## Phase 2: Video, Bảo Mật, Thông Báo Và Báo Cáo Nâng Cao

### Mục Tiêu Phase 2

Hoàn thiện vận hành dài hạn: xử lý video, bảo mật, consent, thông báo tự động, báo cáo sâu và workflow khiếu nại/duyệt lại đầy đủ.

### Phạm Vi Phase 2

1. Video và YouTube

- Thêm hàng đợi upload video.
- Worker upload lên YouTube bằng tài khoản `k12teaching@gmail.com`.
- Trạng thái video:
  - `queued`
  - `uploading`
  - `ready`
  - `failed`
  - `locked`
  - `expired`
- TPS chỉ lưu:
  - `youtube_video_id`
  - URL
  - thumbnail
  - duration
  - upload status
  - error/retry log
- Không lưu file video lâu dài trong TPS.

2. Bảo mật và retention

- Video mặc định `Unlisted`.
- Áp dụng thời hạn xem 6 tháng.
- Sau 6 tháng: khóa trong TPS, private video, hoặc xóa link theo policy được chốt.
- Phân quyền xem video theo đối tượng được phép.
- Audit log mỗi lần xem/sửa/khóa video.

3. Consent và khiếu nại

- Lưu nội dung consent.
- Lưu trạng thái đồng ý của ứng viên/giáo viên.
- Cho phép Teaching HO cấu hình quy tắc consent.
- Thêm workflow khiếu nại:
  - gửi khiếu nại
  - tiếp nhận
  - xử lý
  - kết luận
  - yêu cầu duyệt lại nếu cần

4. Nhận xét theo video

- Cho phép hội đồng gắn nhận xét theo mốc thời gian video.
- Ứng viên/giáo viên xem nhận xét sau khi kết quả được công bố.
- Hỗ trợ lọc nhận xét theo reviewer/tiêu chí.

5. Attendance online

- Lưu check-in/check-out.
- Lưu ai tham gia, vào lúc nào, rời lúc nào.
- Tính thời lượng tham gia.
- Dùng attendance làm evidence cho buổi duyệt.

6. Thông báo tự động

- In-app notification và email cho các sự kiện:
  - request mới
  - request cần bổ sung
  - lịch được công bố
  - nhắc trước 24 giờ
  - nhắc trước 30 phút
  - lịch thay đổi/hủy
  - video sẵn sàng
  - đủ bài chấm
  - kết quả công bố

7. Báo cáo nâng cao

- Dashboard Teaching HO:
  - số request theo trạng thái
  - tỷ lệ đạt
  - điểm trung bình
  - backlog chưa xếp lịch
  - hội đồng quá tải
- Báo cáo theo:
  - ứng viên/giáo viên
  - cơ sở
  - khối/môn
  - hội đồng
  - đợt duyệt
  - lần duyệt lại

### Dữ Liệu Cần Thêm Trong Phase 2

Các bảng đề xuất:

- `lecture_review_video_jobs`
- `lecture_review_video_access_logs`
- `lecture_review_consents`
- `lecture_review_attendance`
- `lecture_review_appeals`
- `lecture_review_notifications`
- `lecture_review_status_history`

### Cần Chuẩn Bị Trước Phase 2

1. YouTube/OAuth

- Google Cloud project.
- Enable YouTube Data API.
- OAuth app cho tài khoản `k12teaching@gmail.com`.
- Refresh token và secret lưu trong secret manager.
- Quota owner và người quản lý credential.

2. Policy video

- Ai được xem video.
- Video sau 6 tháng sẽ bị khóa, private hay xóa.
- Có cho download không.
- Có watermark/view tracking không.

3. Consent

- Nội dung consent chính thức.
- Ai bắt buộc consent.
- Trường hợp không đồng ý thì xử lý thế nào.

4. Khiếu nại

- Thời hạn gửi khiếu nại.
- Ai xử lý khiếu nại.
- Kết quả khiếu nại có tạo duyệt lại tự động không.
- Có giữ nguyên điểm cũ trong báo cáo không.

5. Báo cáo

- Mẫu dashboard Teaching HO mong muốn.
- Các filter bắt buộc.
- Export Excel/PDF có cần trong Phase 2 không.

## Thứ Tự Triển Khai Đề Xuất

1. Chốt business rules Phase 1.
2. Tạo migration cho request/session/panelist/rubric/score/result.
3. Seed rubric 25 tiêu chí.
4. Làm API request và lịch.
5. Làm UI Teaching HO.
6. Làm UI Leader tạo request.
7. Làm UI hội đồng chấm rubric.
8. Làm Candidate Portal hiển thị lịch/kết quả.
9. Sync điểm duyệt giảng về bảng Tập Huấn Sư Phạm.
10. Kiểm thử end-to-end với 1 đợt duyệt thật.
11. Sau khi Phase 1 ổn định, bắt đầu Phase 2.

## Các Quyết Định Còn Mở

- `4.4` thuộc mức 4 hay mức 5.
- Điểm đạt tối thiểu là bao nhiêu.
- Kết quả công bố tự động hay Teaching HO bấm công bố.
- Rubric có trọng số đồng đều hay có tiêu chí trọng số riêng.
- Hội đồng có được sửa điểm sau khi nộp không.
- Duyệt lại có thay thế kết quả cũ hay tạo kết quả mới song song.
- Ai được xem video trong TPS.
- Sau 6 tháng xử lý video như thế nào.
