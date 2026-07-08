'use client'

import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Stepper } from '@/components/ui/stepper'
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/lib/auth-context'
import { findMatchingCampus } from '@/lib/campus-data'
import {
  isExamInCurrentVietnamMonth,
  vietnamYearMonthKey,
} from '@/lib/giaitrinh-eligibility'
import { useTeacher } from '@/lib/teacher-context'
import { Plus } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { toast } from '@/lib/app-toast'

interface Explanation {
  id: number
  assignment_id?: number
  teacher_name: string
  lms_code: string
  email: string
  campus: string
  subject: string
  test_date: string
  reason: string
  status: 'pending' | 'accepted' | 'rejected'
  admin_note?: string
  created_at: string
  updated_at: string
}

interface RegisteredExam {
  result_id: number
  id?: number
  subject_name: string
  block_code?: string | null
  open_at: string | null
  score: number | string | null
  assignment_status?: string | null
  score_status?: string | null
  score_handling_note?: string | null
  explanation_status?: 'pending' | 'accepted' | 'rejected' | null
}

const toVietnamDateInputValue = (value: string | null | undefined) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

const formatExamOptionLabel = (exam: RegisteredExam) => {
  const date = exam.open_at
    ? new Date(exam.open_at).toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
      })
    : 'Chưa có ngày thi'

  return `${exam.subject_name || 'Bài kiểm tra'} - ${date}`
}

const isCompletedZeroScoreExam = (exam: RegisteredExam) => {
  const scoreNumber = Number(exam.score)
  const hasZeroScore =
    exam.score !== null && exam.score !== undefined && scoreNumber === 0
  const assignmentStatus = String(exam.assignment_status || '').toLowerCase()
  const scoreStatus = String(exam.score_status || '').toLowerCase()
  const handlingNote = String(exam.score_handling_note || '').toLowerCase()
  const completed =
    assignmentStatus === 'graded' ||
    assignmentStatus === 'submitted' ||
    scoreStatus === 'graded' ||
    handlingNote.includes('hoàn thành') ||
    handlingNote.includes('hoan thanh') ||
    handlingNote.includes('da thi') ||
    handlingNote.includes('đã hoàn thành')

  return hasZeroScore && completed
}

export default function GiaiTrinhPage() {
  const { user } = useAuth()
  const { teacherProfile, isLoading: isTeacherLoading } = useTeacher()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [explanations, setExplanations] = useState<Explanation[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedExplanation, setSelectedExplanation] =
    useState<Explanation | null>(null)
  const [registeredExams, setRegisteredExams] = useState<RegisteredExam[]>([])
  const [loadingExams, setLoadingExams] = useState(false)
  const [selectedExamId, setSelectedExamId] = useState('')
  const currentVietnamMonth = useMemo(() => vietnamYearMonthKey(new Date()), [])
  const eligibleExams = useMemo(
    () =>
      registeredExams.filter(
        (exam) =>
          isCompletedZeroScoreExam(exam) &&
          isExamInCurrentVietnamMonth(exam.open_at) &&
          exam.explanation_status !== 'accepted',
      ),
    [registeredExams],
  )
  const selectedExam = useMemo(
    () =>
      eligibleExams.find((exam) => String(exam.result_id) === selectedExamId) ||
      null,
    [eligibleExams, selectedExamId],
  )

  const [formData, setFormData] = useState({
    assignment_id: '',
    teacher_name: '',
    lms_code: '',
    email: user?.email || '',
    campus: '',
    subject: '',
    test_date: '',
    reason: '',
  })

  useEffect(() => {
    if (teacherProfile) {
      // Improved campus matching algorithm
      // Prioritize branchIn as per user request
      const teacherBranch =
        teacherProfile.branchIn || teacherProfile.branchCurrent || ''

      const matchedCampus = findMatchingCampus(teacherBranch)

      setFormData((prev) => {
        const updated = {
          ...prev,
          teacher_name: teacherProfile.name || prev.teacher_name || '',
          lms_code: teacherProfile.code || prev.lms_code || '',
          campus: matchedCampus || prev.campus || '',
          email:
            teacherProfile.emailMindx ||
            teacherProfile.emailPersonal ||
            prev.email ||
            user?.email ||
            '',
        }

        return updated
      })
    } else {
      // Fallback if teacher profile not found yet or failed
      setFormData((prev) => ({
        ...prev,
        email: prev.email || user?.email || '',
      }))
    }
  }, [teacherProfile, user?.email])

  const prefillAssignmentId = searchParams.get('assignment_id')
  const prefillSubject = searchParams.get('subject')
  const prefillCampus = searchParams.get('campus')
  const prefillTestDate = searchParams.get('test_date')

  // Close modal when clicking outside
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false)
        setSelectedExplanation(null)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  // Fetch danh sách bài kiểm tra đã đăng ký
  const fetchRegisteredExams = async (lmsCode: string) => {
    if (!lmsCode) return
    setLoadingExams(true)
    try {
      const res = await fetch(
        `/api/exam-assignments?teacher_code=${encodeURIComponent(lmsCode)}&month=${encodeURIComponent(currentVietnamMonth)}`,
      )
      const data = await res.json()
      if (data.success) {
        setRegisteredExams(data.data || [])
      }
    } catch (err) {
      console.error('Error fetching registered exams:', err)
    } finally {
      setLoadingExams(false)
    }
  }

  const handleExamSelect = (examId: string) => {
    setSelectedExamId(examId)
    if (!examId) {
      setFormData((prev) => ({
        ...prev,
        subject: '',
        test_date: '',
        assignment_id: '',
      }))
      return
    }
    const exam = registeredExams.find((e) => String(e.result_id) === examId)
    if (exam) {
      const dateStr = toVietnamDateInputValue(exam.open_at)
      setFormData((prev) => ({
        ...prev,
        subject: exam.subject_name || '',
        test_date: dateStr,
        campus: exam.block_code || prev.campus,
        assignment_id: examId,
      }))
    }
  }

  // Fetch danh sách giải trình của user
  const fetchExplanations = async () => {
    try {
      const response = await fetch(`/api/explanations?email=${user?.email}`)
      const data = await response.json()
      if (data.success) {
        setExplanations(data.data)
      }
    } catch (error) {
      console.error('Error fetching explanations:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.email) {
      fetchExplanations()
    }
  }, [user])

  useEffect(() => {
    if (!user?.email || !prefillAssignmentId) return

    if (prefillTestDate && !isExamInCurrentVietnamMonth(prefillTestDate)) {
      toast.error(
        'Chỉ được gửi giải trình cho bài thi trong tháng hiện tại (giờ Việt Nam). Các tháng khác không chấp nhận.',
      )
      router.replace(pathname)
      return
    }

    const normalizedDate = prefillTestDate
      ? new Date(prefillTestDate).toISOString().slice(0, 10)
      : ''

    setFormData((prev) => ({
      ...prev,
      assignment_id: prefillAssignmentId || prev.assignment_id,
      campus: (prefillCampus || prev.campus).trim(),
      subject: (prefillSubject || prev.subject).trim(),
      test_date: normalizedDate || prev.test_date,
      reason:
        prev.reason ||
        `Giải trình cho bài thi quá hạn (Assignment #${prefillAssignmentId}).`,
    }))
    setSelectedExamId(prefillAssignmentId)
    setShowModal(true)
  }, [
    user,
    prefillAssignmentId,
    prefillSubject,
    prefillCampus,
    prefillTestDate,
    pathname,
    router,
  ])

  // Fetch registered exams when modal opens
  useEffect(() => {
    const lmsCode = formData.lms_code || teacherProfile?.code || ''
    if (showModal && lmsCode) {
      fetchRegisteredExams(lmsCode)
    }
    if (!showModal) {
      setSelectedExamId('')
      setRegisteredExams([])
    }
  }, [showModal, formData.lms_code, teacherProfile?.code])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Manual validation cho các fields không dùng HTML required (tránh lỗi hidden input)
    if (!selectedExam) {
      toast.error('Vui lòng chọn bài kiểm tra đã làm trong tháng hiện tại')
      return
    }
    if (!formData.subject.trim()) {
      toast.error('Vui lòng chọn bộ môn')
      return
    }
    if (!formData.test_date) {
      toast.error('Vui lòng chọn ngày kiểm tra')
      return
    }
    if (!formData.reason.trim()) {
      toast.error('Vui lòng nhập lý do giải trình')
      return
    }
    if (formData.test_date && !isExamInCurrentVietnamMonth(formData.test_date)) {
      toast.error(
        'Chỉ được gửi giải trình trong tháng hiện tại (giờ Việt Nam).',
      )
      return
    }
    setSubmitting(true)

    try {
      const response = await fetch('/api/explanations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(
          'Gửi giải trình thành công! Email đã được gửi đến bộ phận học vụ.',
        )
        setShowModal(false)
        setSelectedExamId('')
        setFormData((prev) => ({
          ...prev,
          // Keep campus in form data
          // campus: '',
          assignment_id: '',
          subject: '',
          test_date: '',
          reason: '',
        }))
        fetchExplanations()
      } else {
        toast.error('Lỗi: ' + data.error)
      }
    } catch (error) {
      console.error('Error submitting explanation:', error)
      toast.error('Có lỗi xảy ra khi gửi giải trình')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    return (
      <div className="min-w-60 px-2 py-1 mx-auto">
        <Stepper
          compact
          steps={[
            {
              id: 1,
              label: 'Gửi yêu cầu',
              status: 'completed',
            },
            {
              id: 2,
              label: 'Tiếp nhận',
              status: status === 'pending' ? 'current' : 'completed',
            },
            {
              id: 3,
              label: 'Kết quả',
              status:
                status === 'accepted'
                  ? 'success'
                  : status === 'rejected'
                    ? 'error'
                    : 'upcoming',
            },
          ]}
        />
      </div>
    )
  }

  if (loading || isTeacherLoading) {
    return <PageSkeleton variant="grid" itemCount={6} showHeader={true} />
  }

  return (
    <>
    <PageLayout>
      <PageLayoutContent spacing="xl">
        {/* Header */}
        <PageHeader
          title="Giải Trình Không Tham Gia Kiểm Tra"
          description="Quản lý và theo dõi các giải trình của bạn"
          actions={
            <Button
              onClick={() => setShowModal(true)}
              size="lg"
              className="whitespace-nowrap border-2 border-[#a1001f] bg-[#a1001f] text-white shadow-md hover:bg-[#8a001a]"
            >
              <Plus className="mr-2 h-5 w-5" />
              Tạo Giải Trình Mới
            </Button>
          }
        />

        {/* Modal Form - Responsive for mobile */}
        <Modal
          open={showModal}
          onClose={() => setShowModal(false)}
          title="Tạo Giải Trình Mới"
          size="3xl"
          headerColor="bg-[#a1001f]"
        >
          <form onSubmit={handleSubmit}>
            <div className="space-y-5">
              {/* Row 1: Exam */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Bài kiểm tra đã làm trong tháng hiện tại <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedExamId}
                  onChange={(e) => handleExamSelect(e.target.value)}
                  disabled={loadingExams}
                  className="w-full px-3 py-2.5 border border-[#e7c6cb] rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f] transition-all disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                >
                  <option value="">
                    {loadingExams
                      ? 'Đang tải bài kiểm tra...'
                      : 'Chọn bài kiểm tra cần giải trình'}
                  </option>
                  {eligibleExams.map((exam) => (
                    <option key={exam.result_id} value={String(exam.result_id)}>
                      {formatExamOptionLabel(exam)}
                    </option>
                  ))}
                </select>
                {!loadingExams && eligibleExams.length === 0 && (
                  <p className="mt-2 text-sm text-amber-700">
                    Không có bài kiểm tra đã làm có điểm 0 trong tháng hiện tại để giải trình.
                  </p>
                )}
              </div>

              {selectedExam && (
                <div className="grid grid-cols-1 gap-3 rounded-lg border border-[#f1d1d8] bg-[#fff7f8] p-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Bộ môn</p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {formData.subject || 'Chưa xác định'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Ngày kiểm tra</p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {formData.test_date
                        ? new Date(formData.test_date).toLocaleDateString('vi-VN')
                        : 'Chưa xác định'}
                    </p>
                  </div>
                </div>
              )}

              {/* Lý do */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Lý do không tham gia <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border border-[#e7c6cb] rounded-lg focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f] transition-all resize-none"
                  placeholder="Nhập lý do chi tiết về việc không thể tham gia kiểm tra..."
                />
              </div>
            </div>
            <div className="mt-4 border-t border-[#f1d1d8] pt-3">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full font-medium shadow-sm bg-[#a1001f] text-white hover:bg-[#8a0019]"
              >
                {submitting ? (
                  <span className="flex items-center justify-center">
                    <div className="w-4 h-4 bg-white/30 rounded mr-2"></div>
                    Đang gửi...
                  </span>
                ) : (
                  'Gửi Giải Trình'
                )}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Danh sách giải trình - Responsive Cards */}
        <div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
              <div className="space-y-1.5">
                <h2 className="min-w-0 text-lg sm:text-xl font-semibold text-gray-900">
                  Danh sách giải trình
                </h2>
                <span className="block text-sm text-gray-600">
                  Tổng: {explanations.length} giải trình
                </span>
              </div>
            </div>

            {explanations.length === 0 ? (
              <div className="p-8 sm:p-12 text-center">
                <svg
                  className="mx-auto h-16 w-16 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">
                  Chưa có giải trình nào
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  Chưa có yêu cầu giải trình nào.
                </p>
              </div>
            ) : (
              <div>
                {/* Desktop Table View - Hidden on mobile */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="uppercase tracking-wider pl-6">
                          Created Date
                        </TableHead>
                        <TableHead className="uppercase tracking-wider">
                          Test Date
                        </TableHead>
                        <TableHead className="uppercase tracking-wider">
                          Campus
                        </TableHead>
                        <TableHead className="uppercase tracking-wider">
                          Subject
                        </TableHead>
                        <TableHead className="uppercase tracking-wider">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {explanations.map((explanation) => (
                        <TableRow
                          key={explanation.id}
                          className="group cursor-pointer transition-all duration-200 hover:bg-blue-50/80 hover:shadow-md relative z-0 hover:z-10"
                          onClick={() => setSelectedExplanation(explanation)}
                        >
                          <TableCell className="whitespace-nowrap text-gray-900 pl-6">
                            {new Date(
                              explanation.created_at,
                            ).toLocaleDateString('vi-VN')}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-gray-900">
                            {new Date(explanation.test_date).toLocaleDateString(
                              'vi-VN',
                            )}
                          </TableCell>
                          <TableCell className="text-gray-900">
                            <div className="max-w-xs truncate">
                              {explanation.campus}
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-900">
                            <div className="max-w-xs truncate">
                              {explanation.subject}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {getStatusBadge(explanation.status)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View - Visible on mobile and tablet */}
                <div className="lg:hidden divide-y divide-gray-200">
                  {explanations.map((explanation) => (
                    <div
                      key={explanation.id}
                      onClick={() => setSelectedExplanation(explanation)}
                      className="p-4 hover:bg-gray-50 transition-colors cursor-pointer active:bg-gray-100"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {explanation.campus}
                          </p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            {explanation.subject}
                          </p>
                        </div>
                        <div className="ml-3 shrink-0">
                          {getStatusBadge(explanation.status)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-gray-500">Ngày tạo:</span>
                          <p className="text-gray-900 font-medium mt-0.5">
                            {new Date(
                              explanation.created_at,
                            ).toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Ngày kiểm tra:</span>
                          <p className="text-gray-900 font-medium mt-0.5">
                            {new Date(explanation.test_date).toLocaleDateString(
                              'vi-VN',
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center text-xs text-blue-600 font-medium">
                        <span>Xem chi tiết</span>
                        <svg
                          className="w-4 h-4 ml-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </PageLayoutContent>
    </PageLayout>

    {/* Detail Modal - Mobile Optimized */}
    <Modal
      open={!!selectedExplanation}
      onClose={() => setSelectedExplanation(null)}
      title="Chi Tiết Giải Trình"
      size="2xl"
      footer={
        <Button
            variant="secondary"
            onClick={() => setSelectedExplanation(null)}
            className="w-full sm:w-auto bg-gray-600 text-white hover:bg-gray-700 font-medium hover:text-white"
          >
            Đóng
          </Button>
        }
      >
        {selectedExplanation && (
          <div className="space-y-4">
            {/* Status Stepper */}
            <div className="pb-6 pt-2 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700 block mb-4">
                Tiến trình xử lý:
              </span>
              <div className="px-4">
                <Stepper
                  steps={[
                    {
                      id: 1,
                      label: 'Gửi yêu cầu',
                      description: 'Mới tạo',
                      status: 'completed',
                    },
                    {
                      id: 2,
                      label: 'Tiếp nhận',
                      description: 'Đang xử lý',
                      status:
                        selectedExplanation.status === 'pending'
                          ? 'current'
                          : 'completed',
                    },
                    {
                      id: 3,
                      label: 'Kết quả',
                      description:
                        selectedExplanation.status === 'accepted'
                          ? 'Đã duyệt'
                          : selectedExplanation.status === 'rejected'
                            ? 'Từ chối'
                            : 'Chờ duyệt',
                      status:
                        selectedExplanation.status === 'accepted'
                          ? 'success'
                          : selectedExplanation.status === 'rejected'
                            ? 'error'
                            : 'upcoming',
                    },
                  ]}
                />
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Họ và tên</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedExplanation.teacher_name}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Mã LMS</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedExplanation.lms_code}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 sm:col-span-2">
                <p className="text-xs text-gray-600 mb-1">Email</p>
                <p className="text-sm font-medium text-gray-900 break-all">
                  {selectedExplanation.email}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Cơ sở</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedExplanation.campus}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Bộ môn</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedExplanation.subject}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Ngày kiểm tra</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(selectedExplanation.test_date).toLocaleDateString(
                    'vi-VN',
                    {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    },
                  )}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Ngày tạo</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(selectedExplanation.created_at).toLocaleDateString(
                    'vi-VN',
                  )}
                </p>
              </div>
            </div>

            {/* Reason Section */}
            <div className="pt-2">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Lý do không tham gia:
              </p>
              <div className="bg-[#fff5f7] border border-[#f1d1d8] rounded-lg p-4">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {selectedExplanation.reason}
                </p>
              </div>
            </div>

            {/* Admin Note */}
            {selectedExplanation.admin_note && (
              <div className="pt-2">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Ghi chú từ quản lý:
                </p>
                <div
                  className={`border rounded-lg p-4 ${
                    selectedExplanation.status === 'accepted'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {selectedExplanation.admin_note}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
