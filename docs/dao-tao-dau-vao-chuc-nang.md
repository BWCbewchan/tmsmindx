# Chức năng module đào tạo đầu vào

Tài liệu này ghi nhanh các chức năng chính của module **Đào tạo đầu vào** trong dự án hiện tại.

| Khu vực | Chức năng | Mô tả ngắn |
|---|---|---|
| Đào tạo đầu vào | Dashboard GEN | Xem tổng quan ứng viên theo GEN, trạng thái đào tạo, điểm trung bình và lọc theo khu vực. |
| Đào tạo đầu vào | Điều phối ứng viên | Quản lý danh sách ứng viên sau phỏng vấn, tìm kiếm, lọc, phân trang và xem chi tiết. |
| Đào tạo đầu vào | GEN Planner | Gom dữ liệu ứng viên, theo dõi tiến độ theo GEN, chuyển giữa các tab planner / tracking / scheduling / overview. |
| Đào tạo đầu vào | Theo dõi đào tạo | Ghi điểm danh, điểm test theo từng buổi, lưu hàng loạt và đổi trạng thái ứng viên sang đạt / không đạt / bỏ học. |
| Đào tạo đầu vào | Xếp lịch training | Tạo và chỉnh lịch theo GEN, chọn online / offline, nhập ngày giờ, địa điểm hoặc link học. |
| Đào tạo đầu vào | Theo dõi lịch training | Xem lịch đào tạo tổng hợp của toàn bộ GEN và lọc theo khu vực hoặc GEN cụ thể. |
| Đào tạo đầu vào | Quản lý video đào tạo | Upload video, phân loại nháp / đã giao / đã khóa, sửa metadata, xem video và xóa video. |
| Đào tạo đầu vào | Câu hỏi trong video | Thêm / sửa / xóa câu hỏi gắn theo thời điểm trong video. |
| Đào tạo đầu vào | Bài kiểm tra sau video | Tạo hoặc liên kết bài kiểm tra để gắn với video trước khi giao cho ứng viên. |
| Đào tạo đầu vào | Thư viện bài kiểm tra đầu vào | Quản lý bài kiểm tra cho đào tạo tập trung và tập huấn sư phạm, gắn video và target theo lesson. |
| Đào tạo đầu vào | Cấu hình bảng điểm | Thiết lập rubric, trọng số, ngưỡng pass, xuất CSV và lưu mẫu đánh giá đầu vào. |
| Đào tạo đầu vào | Tập huấn sư phạm | Theo dõi danh sách giáo viên, lọc theo cơ sở và xem tiến độ lesson 1-4 cùng điểm tổng hợp. |
| Đào tạo đầu vào | Candidate portal | Ứng viên xem roadmap đào tạo, học video và làm bài tập khi đủ điều kiện hoàn thành video. |

## Tóm tắt luồng chính

1. HR nhập và lọc ứng viên đầu vào.
2. HR xếp GEN, tạo buổi training, ghi điểm danh và điểm test.
3. HR tạo video onboarding, thêm câu hỏi, gắn bài kiểm tra và giao video.
4. HR cấu hình rubric đánh giá và theo dõi tiến độ tập huấn sư phạm.
5. Ứng viên/giáo viên xem video, làm bài tập và hoàn tất các bước đào tạo theo roadmap.
