'use client'

import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/lib/app-toast'
import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileUp,
  Medal,
  Search,
  Star,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type AdminCheckCongTab = 'records' | 'analytics'
type StatusFilter = 'all' | 'CHECKED' | 'UNCHECKED'

interface AdminCheckCongRecord {
  centre: string
  type: string
  className: string
  course: string
  courseLine: string
  teacherName: string
  workEmail: string
  personalEmail: string
  username: string
  roleType: string
  status: string
  slotTime: string
  slotDuration: number
  effectiveDuration: number
  studentCount: number | null
}

interface TeacherRankingItem {
  teacherName: string
  username: string
  workEmail: string
  checkedRecords: number
  totalRecords: number
  centres: string[]
}

interface AdminCheckCongResponse {
  success: boolean
  error?: string
  summary: {
    totalRecords: number
    checkedRecords: number
    uncheckedRecords: number
    classSessions: number
    officeHours: number
    totalSlotDuration: number
    totalEffectiveDuration: number
    checkRate: number
    monthLabel: string
  }
  records: AdminCheckCongRecord[]
  totalAvailableRecords: number
  availableMonths: string[]
  analytics: {
    teacherCount: number
    checkedByType: Record<string, number>
    teacherRanking: TeacherRankingItem[]
    topTeachers: TeacherRankingItem[]
  }
  pagination: {
    page: number
    limit: number
    totalRecords: number
    returnedRecords: number
    hasMore: boolean
  }
}

const formatNumber = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(value))

function formatSlotTime(raw: string): string {
  if (!raw) return '-'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function cleanText(value: string | null | undefined): string {
  const text = String(value ?? '').trim()
  if (!text || ['undefined', 'null'].includes(text.toLowerCase())) return ''
  return text
}

function getSessionTitle(record: AdminCheckCongRecord): string {
  const className = cleanText(record.className)
  if (className) return className
  if (record.type === 'OFFICE_HOURS') return 'Trực trải nghiệm'
  return cleanText(record.roleType) || record.type || 'Ca công'
}

function getSessionType(record: AdminCheckCongRecord): string {
  if (record.type === 'OFFICE_HOURS') {
    return cleanText(record.roleType) || 'Office hours'
  }
  return cleanText(record.type) || '-'
}

function checkedStatusLabel(status: string): 'Checked' | 'Unchecked' {
  return status === 'CHECKED' ? 'Checked' : 'Unchecked'
}

function RankAdornment({ index }: { index: number }) {
  if (index === 0) return <Trophy className="h-5 w-5 text-amber-500" />
  if (index === 1) return <Medal className="h-5 w-5 text-slate-500" />
  if (index === 2) return <Medal className="h-5 w-5 text-orange-500" />
  if (index === 3 || index === 4) {
    return <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
  }
  return null
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  tone: 'brand' | 'green' | 'red' | 'blue' | 'amber'
}) {
  const tones = {
    brand: 'text-[#a1001f] bg-red-50 border-red-100',
    green: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    red: 'text-red-600 bg-red-50 border-red-100',
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {label}
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-950">{value}</div>
        </div>
        <div className={`rounded-lg border p-3 ${tones[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}

export default function AdminCheckCongPage() {
  const { token } = useAuth()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const tableScrollRef = useRef<HTMLDivElement | null>(null)
  const requestSeqRef = useRef(0)
  const fetchingPageRef = useRef(false)
  const dataRef = useRef<AdminCheckCongResponse | null>(null)
  const [month, setMonth] = useState('all')
  const [tab, setTab] = useState<AdminCheckCongTab>('records')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [queryInput, setQueryInput] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [data, setData] = useState<AdminCheckCongResponse | null>(null)
  const [loadedRecords, setLoadedRecords] = useState<AdminCheckCongRecord[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const fetchPage = useCallback(
    async (targetPage: number, mode: 'reset' | 'append') => {
      if (fetchingPageRef.current && mode === 'append') return

      fetchingPageRef.current = true
      const requestId =
        mode === 'reset' ? ++requestSeqRef.current : requestSeqRef.current

      if (mode === 'reset') {
        if (dataRef.current) setIsRefreshing(true)
        else setIsInitialLoading(true)
      } else {
        setIsLoadingMore(true)
      }

      try {
        const params = new URLSearchParams({
          month,
          page: String(targetPage),
          limit: '20',
          status: statusFilter,
          q: debouncedQuery,
        })
        const response = await fetch(`/api/admin/check-cong?${params}`, {
          headers: authHeaders(token),
        })
        const result = (await response
          .json()
          .catch(() => ({}))) as AdminCheckCongResponse
        if (!response.ok || result.success === false) {
          throw new Error(result.error || 'Không thể tải dữ liệu check công')
        }
        if (requestId !== requestSeqRef.current) return

        dataRef.current = result
        setData(result)
        setLoadedRecords((current) =>
          mode === 'reset' ? result.records : [...current, ...result.records],
        )
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Không thể tải dữ liệu check công',
        )
      } finally {
        if (requestId === requestSeqRef.current) {
          if (mode === 'reset') {
            setIsInitialLoading(false)
            setIsRefreshing(false)
          } else {
            setIsLoadingMore(false)
          }
        }
        fetchingPageRef.current = false
      }
    },
    [debouncedQuery, month, statusFilter, token],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(queryInput.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [queryInput])

  useEffect(() => {
    tableScrollRef.current?.scrollTo({ top: 0 })
    void fetchPage(1, 'reset')
  }, [fetchPage])

  const maxTypeCount = Math.max(
    1,
    ...Object.values(data?.analytics.checkedByType ?? {}),
  )

  function handleTableScroll(event: React.UIEvent<HTMLDivElement>) {
    const target = event.currentTarget
    const nearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 140
    if (
      nearBottom &&
      data?.pagination.hasMore &&
      !isInitialLoading &&
      !isLoadingMore
    ) {
      void fetchPage(data.pagination.page + 1, 'append')
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('month', month)

    setIsUploading(true)
    try {
      const response = await fetch('/api/admin/check-cong', {
        method: 'POST',
        headers: authHeaders(token),
        body: formData,
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Upload CSV thất bại')
      }
      toast.success(`Đã upload ${formatNumber(result.uploaded.recordCount)} dòng`)
      setLoadedRecords([])
      tableScrollRef.current?.scrollTo({ top: 0 })
      await fetchPage(1, 'reset')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload CSV thất bại')
    } finally {
      setIsUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <PageContainer
      title="Check công giáo viên"
      description="Quản lý dữ liệu công từ file CSV cuối tháng và phân tích số ca checked của toàn bộ giáo viên."
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            type="button"
            variant="mindx"
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
          >
            <FileUp className="h-4 w-4" />
            {isUploading ? 'Đang tải lên...' : 'Tải CSV'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'records' as const, label: 'Check công', icon: ClipboardCheck },
                { value: 'analytics' as const, label: 'Vinh danh & phân tích', icon: Trophy },
              ].map((item) => {
                const ActiveIcon = item.icon
                const active = tab === item.value
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTab(item.value)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-[#a1001f] text-white shadow-sm'
                        : 'border border-gray-200 bg-white text-gray-700 hover:border-[#a1001f]/40 hover:text-[#a1001f]'
                    }`}
                  >
                    <ActiveIcon className="h-4 w-4" />
                    {item.label}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20"
              >
                <option value="all">Tất cả dữ liệu</option>
                {(data?.availableMonths ?? []).map((value) => {
                  const [year, monthValue] = value.split('-')
                  return (
                    <option key={value} value={value}>
                      Tháng {Number(monthValue)}/{year}
                    </option>
                  )
                })}
              </select>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder="Tìm GV, mã lớp, cơ sở..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-[#a1001f] focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20 sm:w-72"
                />
              </div>
            </div>
          </div>
        </div>

        {isInitialLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-lg bg-gray-100"
              />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <StatCard
                icon={ClipboardCheck}
                label="Tổng số"
                value={formatNumber(data.summary.totalRecords)}
                tone="brand"
              />
              <StatCard
                icon={CheckCircle2}
                label="Checked"
                value={formatNumber(data.summary.checkedRecords)}
                tone="green"
              />
              <StatCard
                icon={XCircle}
                label="Unchecked"
                value={formatNumber(data.summary.uncheckedRecords)}
                tone="red"
              />
              <StatCard
                icon={BarChart3}
                label="Tỷ lệ check"
                value={`${data.summary.checkRate.toFixed(1)}%`}
                tone="amber"
              />
              <StatCard
                icon={Users}
                label="Số giáo viên"
                value={formatNumber(data.analytics.teacherCount)}
                tone="blue"
              />
            </div>

            {tab === 'records' ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex rounded-lg border border-gray-200 bg-white p-1">
                    {[
                      { value: 'all' as const, label: 'All' },
                      { value: 'CHECKED' as const, label: 'Checked' },
                      { value: 'UNCHECKED' as const, label: 'Unchecked' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setStatusFilter(option.value)}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                          statusFilter === option.value
                            ? 'bg-[#a1001f] text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-[#a1001f]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="text-sm text-gray-500">
                    {isRefreshing ? (
                      <span className="mr-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                        Đang cập nhật...
                      </span>
                    ) : null}
                    Đang hiển thị{' '}
                    <span className="font-bold text-gray-900">
                      {formatNumber(loadedRecords.length)}
                    </span>{' '}
                    / {formatNumber(data.pagination.totalRecords)} dòng
                  </div>
                </div>

                <div
                  ref={tableScrollRef}
                  onScroll={handleTableScroll}
                  className="max-h-[620px] overflow-auto rounded-lg border border-gray-200 bg-white"
                >
                  <Table className="min-w-[1180px] text-xs">
                    <TableHeader className="sticky top-0 z-10 bg-gray-50">
                      <TableRow>
                        <TableHead>Thời gian</TableHead>
                        <TableHead>Giáo viên</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Loại</TableHead>
                        <TableHead>Lớp/OH</TableHead>
                        <TableHead>Bộ môn</TableHead>
                        <TableHead>Cơ sở</TableHead>
                        <TableHead className="text-center">Số HV</TableHead>
                        <TableHead className="text-center">Công</TableHead>
                        <TableHead className="text-center">Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadedRecords.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={10}
                            className="py-8 text-center text-sm text-gray-500"
                          >
                            Không có dòng nào theo bộ lọc hiện tại.
                          </TableCell>
                        </TableRow>
                      ) : (
                        loadedRecords.map((record, index) => (
                          <TableRow key={`${record.slotTime}-${record.username}-${index}`}>
                            <TableCell className="font-medium text-gray-800">
                              {formatSlotTime(record.slotTime)}
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-gray-900">
                                {record.teacherName || '-'}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                {record.workEmail || '-'}
                              </div>
                            </TableCell>
                            <TableCell>{record.username || '-'}</TableCell>
                            <TableCell>{getSessionType(record)}</TableCell>
                            <TableCell className="font-semibold">
                              {getSessionTitle(record)}
                            </TableCell>
                            <TableCell>
                              {[record.course, record.courseLine]
                                .map(cleanText)
                                .filter(Boolean)
                                .join(', ') || '-'}
                            </TableCell>
                            <TableCell>{record.centre || '-'}</TableCell>
                            <TableCell className="text-center font-semibold">
                              {record.studentCount ?? '-'}
                            </TableCell>
                            <TableCell className="text-center font-semibold">
                              {record.effectiveDuration || record.slotDuration || 0}
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                                  record.status === 'CHECKED'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {checkedStatusLabel(record.status)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                      {isLoadingMore && (
                        <TableRow>
                          <TableCell
                            colSpan={10}
                            className="py-4 text-center text-xs font-semibold text-gray-500"
                          >
                            Đang tải thêm...
                          </TableCell>
                        </TableRow>
                      )}
                      {data.pagination.hasMore && !isLoadingMore && (
                        <TableRow>
                          <TableCell
                            colSpan={10}
                            className="py-4 text-center text-xs font-semibold text-gray-500"
                          >
                            Kéo xuống để tải thêm...
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.6fr]">
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-5">
                    <h3 className="text-base font-bold text-gray-950">
                      Phân bổ ca checked theo loại
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Chỉ tính các dòng có trạng thái Checked.
                    </p>
                  </div>
                  <div className="space-y-5">
                    {Object.entries(data.analytics.checkedByType).length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                        Chưa có ca checked trong kỳ này.
                      </div>
                    ) : (
                      Object.entries(data.analytics.checkedByType).map(
                        ([type, count]) => (
                          <div key={type}>
                            <div className="mb-2 flex items-center justify-between text-sm">
                              <span className="font-bold text-gray-900">
                                {type === 'CLASS' ? 'Lớp học (CLASS)' : 'Office Hours'}
                              </span>
                              <span className="font-semibold text-gray-500">
                                {formatNumber(count)}
                              </span>
                            </div>
                            <div className="h-3 rounded-full bg-gray-100">
                              <div
                                className={`h-3 rounded-full ${
                                  type === 'CLASS' ? 'bg-emerald-500' : 'bg-blue-500'
                                }`}
                                style={{
                                  width: `${Math.max(8, (count / maxTypeCount) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        ),
                      )
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    <div>
                      <h3 className="text-base font-bold text-gray-950">
                        Top 10 giáo viên check nhiều nhất
                      </h3>
                      <p className="text-sm text-gray-500">
                        Xếp hạng theo số lượng ca Checked.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {data.analytics.topTeachers.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                        Chưa có dữ liệu xếp hạng.
                      </div>
                    ) : (
                      data.analytics.topTeachers.map((teacher, index) => (
                        <div
                          key={`${teacher.username}-${teacher.workEmail}-${index}`}
                          className="group flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#a1001f]/25 hover:bg-red-50/30 hover:shadow-md"
                        >
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${
                              index < 3
                                ? 'bg-[#a1001f]'
                                : 'bg-slate-600'
                            }`}
                          >
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-gray-950">
                              {teacher.username || teacher.workEmail || '-'} -{' '}
                              {teacher.teacherName || 'Chưa có tên'}
                            </div>
                            <div className="mt-0.5 text-sm text-gray-500">
                              {formatNumber(teacher.checkedRecords)} ca checked /{' '}
                              {formatNumber(teacher.totalRecords)} tổng số
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {teacher.centres.slice(0, 6).map((centre) => (
                                <span
                                  key={centre}
                                  className="rounded-full border border-[#c7c2ff] bg-[#ecebff] px-2 py-0.5 text-[11px] font-semibold text-[#5146d9] transition-colors group-hover:border-[#aaa2ff] group-hover:bg-[#e3e1ff]"
                                >
                                  {centre}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white transition-transform group-hover:scale-110">
                            <RankAdornment index={index} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            Chưa tải được dữ liệu check công.
          </div>
        )}
      </div>
    </PageContainer>
  )
}
