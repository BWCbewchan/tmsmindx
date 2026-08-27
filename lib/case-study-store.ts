// ─── Types ────────────────────────────────────────────────────────────────────

export interface CaseStudy {
  id: string
  category: string
  title: string
  directions: string[]
  notes?: string
  createdAt?: string // ISO date string
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const CASE_CATEGORIES = [
  'Quản lý lớp học',
  'Tương tác học sinh',
  'Kỹ thuật giảng dạy',
  'Xử lý tình huống đặc biệt',
] as const

export type CaseCategory = (typeof CASE_CATEGORIES)[number]

const STORAGE_KEY = 'tps-case-studies'

// ─── Default data ─────────────────────────────────────────────────────────────

export const DEFAULT_CASE_STUDIES: CaseStudy[] = [
  {
    id: 'cs-01',
    createdAt: '2025-01-01T00:00:00.000Z',
    category: 'Quản lý lớp học',
    title: 'Học sinh mất trật tự, nói chuyện riêng trong giờ học',
    directions: [
      'Dừng bài giảng, im lặng 3–5 giây để thu hút sự chú ý của cả lớp.',
      'Gọi tên học sinh bằng giọng bình tĩnh, không to, không mang tính phán xét: "Em [Tên], mình cùng tập trung nhé."',
      'Đặt câu hỏi liên quan đến bài học để kéo học sinh trở lại: "Em nghĩ bước tiếp theo là gì?"',
      'Nếu hành vi tiếp diễn, nói chuyện riêng với học sinh sau giờ học — không khiển trách trước lớp.',
      'Ghi chú vào sổ theo dõi lớp và báo cáo cho TL nếu cần thiết.',
    ],
    notes: 'Tránh phản ứng thái quá hoặc xử lý giữa lớp học khiến học sinh cảm thấy bị bẽ mặt.',
  },
  {
    id: 'cs-02',
    createdAt: '2025-01-01T00:00:00.000Z',
    category: 'Quản lý lớp học',
    title: 'Học sinh từ chối tham gia hoạt động nhóm',
    directions: [
      'Tiếp cận nhẹ nhàng, hỏi học sinh lý do không thoải mái khi tham gia.',
      'Tạo cơ hội cho học sinh đóng vai trò nhỏ hơn trong nhóm (ghi chép, trình bày kết quả).',
      'Không ép buộc — tôn trọng sự khác biệt về tính cách, nhưng khuyến khích dần theo thời gian.',
      'Khen ngợi khi học sinh có bất kỳ nỗ lực nào dù nhỏ để tham gia.',
    ],
  },
  {
    id: 'cs-03',
    createdAt: '2025-01-01T00:00:00.000Z',
    category: 'Tương tác học sinh',
    title: 'Học sinh khóc hoặc bùng nổ cảm xúc trong lớp',
    directions: [
      'Giữ bình tĩnh — đừng hoảng loạn hay phản ứng thái quá.',
      'Mời học sinh ra ngoài (hành lang hoặc góc riêng tư) nếu có thể, để tránh áp lực trước đám đông.',
      'Lắng nghe mà không phán xét: "Thầy/cô ở đây, em có thể kể chuyện gì xảy ra không?"',
      'Không hỏi quá nhiều câu hỏi liên tiếp — cho học sinh thời gian để bình tĩnh lại.',
      'Báo cáo ngay cho TL/Ban giám hiệu nếu tình huống có dấu hiệu nghiêm trọng.',
    ],
    notes: 'Tuyệt đối không dùng giọng điệu "nín khóc đi", vì điều này làm tổn thương cảm xúc học sinh.',
  },
  {
    id: 'cs-04',
    createdAt: '2025-01-01T00:00:00.000Z',
    category: 'Tương tác học sinh',
    title: 'Học sinh phản ứng không lịch sự, cãi lại giáo viên',
    directions: [
      'Không leo thang xung đột — duy trì giọng điệu bình tĩnh và chuyên nghiệp.',
      'Nói: "Thầy/cô hiểu em có thể đang bực bội, nhưng chúng ta cần nói chuyện đúng cách."',
      'Không xử lý kỷ luật ngay tại lớp — hẹn gặp sau giờ học hoặc kết thúc tiết.',
      'Ghi chép lại sự việc (thời gian, lời nói cụ thể) và báo cáo TL trong ngày.',
      'Phối hợp với phụ huynh nếu hành vi tái diễn.',
    ],
    notes: 'Mục tiêu là giữ uy tín và không gây thêm căng thẳng trước toàn lớp.',
  },
  {
    id: 'cs-05',
    createdAt: '2025-01-01T00:00:00.000Z',
    category: 'Kỹ thuật giảng dạy',
    title: 'Học sinh không hiểu bài dù đã giải thích nhiều lần',
    directions: [
      'Thay đổi cách giải thích: dùng ví dụ thực tế gần gũi hơn, hình ảnh hoặc sơ đồ.',
      'Phân nhỏ nội dung thành các bước nhỏ hơn và kiểm tra từng bước.',
      'Cho học sinh tự thử làm và hỏi "Em đang gặp khó khăn ở bước nào?"',
      'Sau lớp, gợi ý tài liệu bổ trợ hoặc hỗ trợ thêm qua kênh phản hồi.',
      'Ghi nhận để cải tiến cách dạy phần đó trong các lớp tiếp theo.',
    ],
  },
  {
    id: 'cs-06',
    createdAt: '2025-01-01T00:00:00.000Z',
    category: 'Kỹ thuật giảng dạy',
    title: 'Lớp học xong sớm hơn kế hoạch, còn dư thời gian',
    directions: [
      'Chuẩn bị sẵn 1–2 hoạt động dự phòng (câu đố, thảo luận mở, mini challenge).',
      'Dùng thời gian để ôn lại kiến thức bài cũ theo dạng vui (ví dụ: quiz nhanh).',
      'Cho học sinh thời gian hỏi bất kỳ câu hỏi nào về bài học hoặc lĩnh vực công nghệ.',
      'Không kéo dài bài học mới ngoài kế hoạch nếu nội dung đó chưa được chuẩn bị kỹ.',
    ],
  },
  {
    id: 'cs-07',
    createdAt: '2025-01-01T00:00:00.000Z',
    category: 'Xử lý tình huống đặc biệt',
    title: 'Phát hiện học sinh bị bắt nạt trong lớp',
    directions: [
      'Dừng ngay hành vi bắt nạt một cách bình tĩnh, không gây thêm chú ý.',
      'Nói chuyện riêng với nạn nhân để đảm bảo học sinh cảm thấy an toàn.',
      'Nói chuyện riêng với học sinh bắt nạt — không phán xét ngay, lắng nghe lý do.',
      'Báo cáo ngay cho TL và phụ huynh của cả hai bên trong ngày.',
      'Theo dõi sát tình hình các buổi học tiếp theo và ghi chép nhật ký sự việc.',
    ],
    notes: 'Đây là tình huống nghiêm trọng — không tự xử lý một mình, luôn cần sự can thiệp của Ban quản lý.',
  },
  {
    id: 'cs-08',
    createdAt: '2025-01-01T00:00:00.000Z',
    category: 'Xử lý tình huống đặc biệt',
    title: 'Thiết bị kỹ thuật gặp sự cố giữa buổi học',
    directions: [
      'Bình tĩnh thông báo cho học sinh và bắt đầu hoạt động không cần thiết bị (thảo luận, làm việc nhóm trên giấy).',
      'Gọi hỗ trợ kỹ thuật hoặc báo cho TL trong vòng 5 phút đầu.',
      'Không để học sinh ngồi chờ quá 10 phút mà không có hoạt động gì.',
      'Sau giờ học, ghi chép vào báo cáo sự cố để cải thiện cho lần sau.',
    ],
  },
  {
    id: 'cs-09',
    createdAt: '2025-01-01T00:00:00.000Z',
    category: 'Quản lý lớp học',
    title: 'Học sinh sử dụng điện thoại trong giờ học',
    directions: [
      'Nhắc nhở chung cho cả lớp trước về quy định sử dụng thiết bị.',
      'Không tịch thu điện thoại — yêu cầu học sinh cất vào túi hoặc mặt xuống bàn.',
      'Nếu tái phạm, yêu cầu ra ngoài lấy túi hoặc nói chuyện riêng sau giờ học.',
      'Kiểm tra xem học sinh có đang dùng vì lý do chính đáng không (tra cứu, dịch thuật...).',
    ],
  },
  {
    id: 'cs-10',
    createdAt: '2025-01-01T00:00:00.000Z',
    category: 'Tương tác học sinh',
    title: 'Học sinh không làm bài tập / trễ deadline liên tục',
    directions: [
      'Hỏi thăm nguyên nhân cụ thể: lý do gia đình, quá nhiều bài, không hiểu đề...',
      'Cùng học sinh lập kế hoạch nhỏ để hoàn thành phần bị thiếu.',
      'Báo cáo cho TL nếu xảy ra 3 lần trở lên trong 1 tháng.',
      'Phối hợp với phụ huynh nếu cần sự hỗ trợ từ gia đình.',
      'Không cho điểm 0 ngay — hỏi lý do và tạo cơ hội nộp muộn có điều kiện.',
    ],
  },
]

// ─── Store helpers (localStorage) ─────────────────────────────────────────────

export function loadCaseStudies(): CaseStudy[] {
  if (typeof window === 'undefined') return DEFAULT_CASE_STUDIES
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CASE_STUDIES
    const parsed = JSON.parse(raw) as CaseStudy[]
    return Array.isArray(parsed) ? parsed : DEFAULT_CASE_STUDIES
  } catch {
    return DEFAULT_CASE_STUDIES
  }
}

export function saveCaseStudies(studies: CaseStudy[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(studies))
  // Notify other tabs / components
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
}

export function generateId(): string {
  return `cs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}
