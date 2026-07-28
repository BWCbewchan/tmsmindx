'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Trophy, Upload, X, CheckCircle, AlertCircle, Trash2, Eye, Star, Crown, Medal, Download, RefreshCw, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import useSWR, { useSWRConfig } from 'swr'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HonorRecord {
  id: number
  stt: number | null
  full_name: string
  email: string | null
  khoi_day: string | null
  co_so: string | null
  thang: string
  so_case: number
  so_hoc_sinh: number
  ti_le: number
  loai: string | null
  thuong_cr: number
  avatar_url: string | null
  slogan: string | null
}

interface VinhDanhData {
  success: boolean
  months: string[]
  current_month: string
  data: HonorRecord[]
}

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json())
const HONORS_SCORE_LABEL = 'CR45'

function initials(name: string) {
  const p = name.trim().split(/\s+/)
  return p.length === 1
    ? p[0].slice(0, 2).toUpperCase()
    : (p[p.length - 2][0] + p[p.length - 1][0]).toUpperCase()
}

// ─── Honor Card (preview display) ────────────────────────────────────────────

function HonorCard({
  record, rank, onSave,
}: {
  record: HonorRecord; rank: number
  onSave?: (id: number, values: { full_name: string; co_so: string; ti_le: string }, avatarFile?: File | null) => Promise<void>
}) {
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [fullNameDraft, setFullNameDraft] = useState(record.full_name)
  const [coSoDraft, setCoSoDraft] = useState(record.co_so || '')
  const [tiLeDraft, setTiLeDraft] = useState(String(record.ti_le))
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [hovered, setHovered] = useState(false)
  const [saving, setSaving] = useState(false)
  const rankConfigs = [
    { badge: 'bg-[#a1001f] text-white', ring: 'ring-amber-200', stripe: 'bg-[#a1001f]', icon: Crown },
    { badge: 'bg-amber-600 text-white', ring: 'ring-amber-100', stripe: 'bg-amber-500', icon: Medal },
    { badge: 'bg-gray-700 text-white', ring: 'ring-gray-200', stripe: 'bg-gray-500', icon: Medal },
  ]
  const cfg = rankConfigs[rank - 1] || rankConfigs[2]
  const Icon = cfg.icon
  const isDirty = fullNameDraft.trim() !== record.full_name
    || coSoDraft.trim() !== (record.co_so || '')
    || Number(tiLeDraft.replace(',', '.')) !== record.ti_le
    || Boolean(avatarFile)

  useEffect(() => {
    setFullNameDraft(record.full_name)
    setCoSoDraft(record.co_so || '')
    setTiLeDraft(String(record.ti_le))
    setAvatarFile(null)
    setAvatarPreview(null)
  }, [record.co_so, record.full_name, record.id, record.ti_le])

  const applyAvatarFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Chỉ hỗ trợ file ảnh')
      return
    }

    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (event) => setAvatarPreview(event.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  useEffect(() => {
    if (!hovered || !onSave) return

    const onWindowPaste = (event: ClipboardEvent) => {
      const pastedImage = getClipboardImageFile(event.clipboardData?.items)
      if (!pastedImage) return

      event.preventDefault()
      applyAvatarFile(pastedImage)
    }

    window.addEventListener('paste', onWindowPaste)
    return () => window.removeEventListener('paste', onWindowPaste)
  }, [applyAvatarFile, hovered, onSave])

  const submit = async () => {
    if (!onSave || !isDirty) return
    const percent = Number(tiLeDraft.replace(',', '.'))
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      alert('CR45 cần là số từ 0 đến 100')
      return
    }
    setSaving(true)
    try {
      await onSave(record.id, {
        full_name: fullNameDraft.trim(),
        co_so: coSoDraft.trim(),
        ti_le: tiLeDraft.trim(),
      }, avatarFile)
      setAvatarFile(null)
      setAvatarPreview(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể lưu thông tin vinh danh')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={cn(
        'relative grid grid-cols-[92px_minmax(0,1fr)_auto] items-center gap-4 overflow-hidden rounded-2xl border border-amber-100 bg-white p-4 text-gray-900 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={cn('absolute left-4 top-3 rounded-lg px-2.5 py-1 text-[11px] font-black shadow-sm', cfg.badge)}>
        Top {rank}
      </div>
      <div className={cn('absolute inset-y-0 left-0 w-1.5', cfg.stripe)} />
      {rank === 1 && <Icon className="absolute right-4 top-3 h-5 w-5 text-amber-500" />}

      <div className={cn(
        'group/avatar relative mt-5 flex h-[78px] w-[78px] shrink-0 items-center justify-center overflow-hidden rounded-full ring-2',
        cfg.ring
      )}>
        {avatarPreview || record.avatar_url ? (
          <img src={avatarPreview || record.avatar_url || ''} alt={record.full_name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-amber-50">
            <span className="text-xl font-black text-amber-700">
              {initials(record.full_name)}
            </span>
          </div>
        )}
        {onSave && (
          <>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className={cn(
                'absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity focus:opacity-100',
                hovered ? 'opacity-100' : 'opacity-0 group-hover/avatar:opacity-100'
              )}
              title="Đổi avatar"
              aria-label={`Đổi avatar cho ${record.full_name}`}
            >
              <Upload className="w-4 h-4" />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const nextFile = e.target.files?.[0]
                if (nextFile) applyAvatarFile(nextFile)
                e.currentTarget.value = ''
              }}
            />
          </>
        )}
      </div>

      <div className="min-w-0 space-y-2 pt-4">
        {onSave ? (
          <input
            value={fullNameDraft}
            onChange={e => setFullNameDraft(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-base font-black leading-tight text-gray-900 outline-none placeholder:text-gray-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            placeholder="Họ và tên"
          />
        ) : (
          <p className="truncate text-base font-black leading-tight">{record.full_name}</p>
        )}
        {onSave ? (
          <input
            value={coSoDraft}
            onChange={e => setCoSoDraft(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 outline-none placeholder:text-gray-400 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
            placeholder="Cơ sở"
          />
        ) : (
          <p className="truncate text-sm font-semibold text-gray-600">{record.co_so || '—'}</p>
        )}

        <div
          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[#6b0015]"
          title={`Chỉ số ${HONORS_SCORE_LABEL}: ${record.ti_le.toFixed(1)}%`}
          aria-label={`Chỉ số ${HONORS_SCORE_LABEL}: ${record.ti_le.toFixed(1)}%`}
        >
          <Star className="h-3 w-3 shrink-0 fill-[#a1001f] text-[#a1001f]" />
          <span className="text-[10px] font-black uppercase leading-none">
            {HONORS_SCORE_LABEL}
          </span>
          <span className="h-3.5 w-px bg-[#a1001f]/20" />
          {onSave ? (
            <label className="flex items-center gap-1">
              <input
                type="text"
                inputMode="decimal"
                value={tiLeDraft}
                onChange={e => setTiLeDraft(e.target.value)}
                className="w-16 bg-transparent text-[15px] font-black tabular-nums text-[#6b0015] outline-none"
                aria-label={`Nhập chỉ số ${HONORS_SCORE_LABEL}`}
              />
              <span className="text-[15px] font-black">%</span>
            </label>
          ) : (
            <span className="text-[15px] font-black tabular-nums">
              {record.ti_le.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {onSave && (
        <div className="flex justify-end pt-4">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={submit}
            disabled={!isDirty || saving || !fullNameDraft.trim()}
            className="min-w-20 border-amber-200 bg-amber-50 text-[#a1001f] hover:bg-amber-100 disabled:bg-gray-50 disabled:text-gray-400"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-gray-900" />
                Lưu
              </span>
            ) : (
              'Lưu'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Podium Preview ───────────────────────────────────────────────────────────

function PodiumPreview({
  records, onSaveRecord,
}: {
  records: HonorRecord[]
  onSaveRecord?: (id: number, values: { full_name: string; co_so: string; ti_le: string }, avatarFile?: File | null) => Promise<void>
}) {
  const top3 = records.slice(0, 3)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      {top3.map((r, i) => (
        <HonorCard
          key={r.id}
          record={r}
          rank={i + 1}
          onSave={onSaveRecord}
        />
      ))}
    </div>
  )
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function HonorRow({ record, index }: { record: HonorRecord; index: number }) {
  return (
    <tr className={cn('transition-colors hover:bg-amber-50/50', index % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}>
      <td className="px-4 py-3 text-center">
        <span className={cn(
          'inline-flex w-7 h-7 items-center justify-center rounded-full text-xs font-black',
          record.stt === 1 ? 'bg-yellow-100 text-yellow-700' :
          record.stt === 2 ? 'bg-gray-100 text-gray-600' :
          record.stt === 3 ? 'bg-orange-100 text-orange-600' :
          'bg-gray-100 text-gray-500'
        )}>
          {record.stt ?? index + 1}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-amber-100 flex items-center justify-center">
            {record.avatar_url ? (
              <img src={record.avatar_url} alt={record.full_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-black text-amber-700">{initials(record.full_name)}</span>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-none">{record.full_name}</p>
            {record.email && <p className="text-xs text-gray-400 mt-0.5">{record.email}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{record.co_so || '—'}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{record.khoi_day || '—'}</td>
      <td className="px-4 py-3 text-center tabular-nums text-sm font-semibold text-gray-700">{record.so_case}</td>
      <td className="px-4 py-3 text-center tabular-nums text-sm font-semibold text-gray-700">{record.so_hoc_sinh}</td>
      <td className="px-4 py-3 text-center">
        <span
          className="inline-flex items-center overflow-hidden rounded-lg border border-amber-200 bg-white text-xs font-black whitespace-nowrap shadow-sm"
          title={`Chỉ số ${HONORS_SCORE_LABEL}: ${record.ti_le.toFixed(1)}%`}
          aria-label={`Chỉ số ${HONORS_SCORE_LABEL}: ${record.ti_le.toFixed(1)}%`}
        >
          <span className="bg-amber-300 px-1.5 py-0.5 text-[9px] uppercase leading-none text-red-950">
            {HONORS_SCORE_LABEL}
          </span>
          <span className="bg-red-950 px-1.5 py-0.5 text-yellow-100 tabular-nums leading-none">
            {record.ti_le.toFixed(1)}%
          </span>
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{record.loai || '—'}</td>
      <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold text-emerald-700">
        {record.thuong_cr > 0 ? record.thuong_cr.toLocaleString('vi-VN') : '—'}
      </td>
    </tr>
  )
}

// ─── Import Dialog ────────────────────────────────────────────────────────────

interface ImportResult {
  success: boolean
  inserted?: number
  total?: number
  source_total?: number
  deleted?: number
  current_month?: string | null
  errors?: string[]
  preview?: Record<string, unknown>[]
  error?: string
}

type TopImageBox = 'top1' | 'top2' | 'top3'
type ImportMode = 'csv' | 'manual'

type ManualHonorRow = {
  full_name: string
  email: string
  co_so: string
  khoi_day: string
  ti_le: string
  so_case: string
  so_hoc_sinh: string
  loai: string
  thuong_cr: string
}

const emptyManualRow = (): ManualHonorRow => ({
  full_name: '',
  email: '',
  co_so: '',
  khoi_day: '',
  ti_le: '',
  so_case: '',
  so_hoc_sinh: '',
  loai: '',
  thuong_cr: '',
})

function csvCell(value: string) {
  const escaped = value.replace(/"/g, '""')
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
}

function getClipboardImageFile(items: DataTransferItemList | undefined | null): File | null {
  if (!items) return null

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      return item.getAsFile()
    }
  }

  return null
}

function ImportDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: (month?: string | null) => void }) {
  const [mode, setMode] = useState<ImportMode>('csv')
  const [file, setFile] = useState<File | null>(null)
  const [thang, setThang] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [manualRows, setManualRows] = useState<ManualHonorRow[]>([
    emptyManualRow(),
    emptyManualRow(),
    emptyManualRow(),
  ])
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Track which image box is hovered for paste
  const [hoveredImageBox, setHoveredImageBox] = useState<TopImageBox | null>(null)
  const [activeImageBox, setActiveImageBox] = useState<TopImageBox | null>(null)
  // Images for top 1, 2, 3
  const [top1Image, setTop1Image] = useState<File | null>(null)
  const [top2Image, setTop2Image] = useState<File | null>(null)
  const [top3Image, setTop3Image] = useState<File | null>(null)
  const [top1Preview, setTop1Preview] = useState<string | null>(null)
  const [top2Preview, setTop2Preview] = useState<string | null>(null)
  const [top3Preview, setTop3Preview] = useState<string | null>(null)
  const top1PasteRef = useRef<HTMLDivElement>(null)
  const top2PasteRef = useRef<HTMLDivElement>(null)
  const top3PasteRef = useRef<HTMLDivElement>(null)

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith('.csv')) {
      alert('Chỉ hỗ trợ file CSV')
      return
    }
    setFile(f)
    setResult(null)
  }, [])

  const updateManualRow = useCallback((index: number, field: keyof ManualHonorRow, value: string) => {
    setManualRows(rows => rows.map((row, rowIndex) => (
      rowIndex === index ? { ...row, [field]: value } : row
    )))
    setResult(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleImageSelect = useCallback((
    file: File,
    setImage: React.Dispatch<React.SetStateAction<File | null>>,
    setPreview: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    if (!file.type.startsWith('image/')) {
      alert('Chỉ hỗ trợ file ảnh')
      return
    }
    setImage(file)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  const applyImageToBox = useCallback((box: TopImageBox, imageFile: File) => {
    if (box === 'top1') {
      handleImageSelect(imageFile, setTop1Image, setTop1Preview)
    } else if (box === 'top2') {
      handleImageSelect(imageFile, setTop2Image, setTop2Preview)
    } else {
      handleImageSelect(imageFile, setTop3Image, setTop3Preview)
    }
  }, [handleImageSelect])

  const focusImagePasteCatcher = useCallback((box: TopImageBox) => {
    setActiveImageBox(box)

    requestAnimationFrame(() => {
      const target = box === 'top1'
        ? top1PasteRef.current
        : box === 'top2'
          ? top2PasteRef.current
          : top3PasteRef.current

      if (!target) return

      target.textContent = ''
      target.focus({ preventScroll: true })

      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(target)
      selection?.removeAllRanges()
      selection?.addRange(range)
    })
  }, [])

  const openImagePicker = useCallback((box: TopImageBox) => {
    setActiveImageBox(box)
    document.getElementById(`${box}ImageInput`)?.click()
  }, [])

  const handleImageBoxKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>, box: TopImageBox) => {
    if (e.key !== 'Enter' && e.key !== ' ') return

    e.preventDefault()
    openImagePicker(box)
  }, [openImagePicker])

  const handleImagePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>, box: TopImageBox) => {
    const pastedImage = getClipboardImageFile(event.clipboardData?.items)

    event.preventDefault()
    event.stopPropagation()
    setActiveImageBox(box)

    if (pastedImage) {
      applyImageToBox(box, pastedImage)
    }
  }, [applyImageToBox])

  useEffect(() => {
    const onWindowPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented) return

      const targetBox = hoveredImageBox || activeImageBox
      if (!targetBox) return

      const pastedImage = getClipboardImageFile(event.clipboardData?.items)
      if (!pastedImage) return

      event.preventDefault()
      applyImageToBox(targetBox, pastedImage)
    }

    window.addEventListener('paste', onWindowPaste)
    return () => window.removeEventListener('paste', onWindowPaste)
  }, [activeImageBox, applyImageToBox, hoveredImageBox])

  // Handle drag event for image boxes
  const handleImageDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // Handle drop event for image boxes
  const handleImageDrop = (e: React.DragEvent, box: TopImageBox) => {
    e.preventDefault()
    setActiveImageBox(box)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      applyImageToBox(box, file)
    }
  }

  const buildManualCsvFile = () => {
    const cleanRows = manualRows.map((row, index) => ({ ...row, stt: String(index + 1) }))
    const missingName = cleanRows.findIndex(row => !row.full_name.trim())
    if (!thang.trim()) {
      setResult({ success: false, error: 'Vui lòng nhập tháng trước khi lưu thủ công.' })
      return null
    }
    if (missingName >= 0) {
      setResult({ success: false, error: `Top ${missingName + 1} đang thiếu họ và tên.` })
      return null
    }

    const headers = ['STT', 'Tên', 'Email', 'Khối dạy', 'Cơ sở', 'Tháng', 'Số case', 'Số học sinh', 'CR45', 'Loại/Chọn', 'Thưởng CR']
    const lines = [
      headers.join(','),
      ...cleanRows.map(row => [
        row.stt,
        row.full_name,
        row.email,
        row.khoi_day,
        row.co_so,
        thang.trim(),
        row.so_case,
        row.so_hoc_sinh,
        row.ti_le,
        row.loai,
        row.thuong_cr,
      ].map(value => csvCell(value.trim())).join(',')),
    ]
    return new File([lines.join('\n')], `vinh-danh-thu-cong-${Date.now()}.csv`, { type: 'text/csv;charset=utf-8' })
  }

  const handleSubmit = async () => {
    const sourceFile = mode === 'csv' ? file : buildManualCsvFile()
    if (!sourceFile) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', sourceFile)
      if (thang) fd.append('thang', thang)
      if (top1Image) fd.append('top1Image', top1Image)
      if (top2Image) fd.append('top2Image', top2Image)
      if (top3Image) fd.append('top3Image', top3Image)
      const res = await fetch('/api/truyenthong/vinh-danh/import', { method: 'POST', body: fd })
      const data: ImportResult = await res.json()
      setResult(data)
      if (data.success && (data.inserted ?? 0) > 0) {
        setTimeout(() => { onSuccess(data.current_month); onClose() }, 1800)
      }
    } catch {
      setResult({ success: false, error: 'Lỗi kết nối máy chủ' })
    } finally {
      setLoading(false)
    }
  }

  const top1PasteTarget = hoveredImageBox === 'top1' || activeImageBox === 'top1'
  const top2PasteTarget = hoveredImageBox === 'top2' || activeImageBox === 'top2'
  const top3PasteTarget = hoveredImageBox === 'top3' || activeImageBox === 'top3'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">Cập nhật Vinh Danh Tháng</h2>
              <p className="text-xs text-gray-500">Import CSV hoặc nhập thủ công Top 1/2/3</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
            aria-label="Đóng"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-180px)] overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 rounded-xl border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => { setMode('csv'); setResult(null) }}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition-colors',
                mode === 'csv' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              )}
            >
              <Upload className="w-3.5 h-3.5" />
              Import CSV
            </button>
            <button
              type="button"
              onClick={() => { setMode('manual'); setResult(null) }}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition-colors',
                mode === 'manual' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              Nhập thủ công
            </button>
          </div>

          {/* Tháng override */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">
              {mode === 'csv' ? 'Tháng (để trống nếu file đã có cột tháng)' : 'Tháng vinh danh'}
            </label>
            <input
              type="text"
              value={thang}
              onChange={e => setThang(e.target.value)}
              placeholder="vd: 06/2025"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>

          {mode === 'csv' ? (
            <>
              {/* Dropzone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
                  dragOver
                    ? 'border-amber-400 bg-amber-50'
                    : file
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/40'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
                />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                    <p className="text-sm font-bold text-green-700">{file.name}</p>
                    <p className="text-xs text-green-600">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-gray-300" />
                    <p className="text-sm font-semibold text-gray-600">Kéo thả file CSV vào đây</p>
                    <p className="text-xs text-gray-400">hoặc click để chọn file</p>
                  </div>
                )}
              </div>

              {/* CSV format hint */}
              <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-800 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold">Định dạng file CSV:</p>
                  <a
                    href="/templates/vinh-danh-mau.csv"
                    download="vinh-danh-mau.csv"
                    className="flex items-center gap-1 text-amber-700 font-bold hover:text-amber-900 hover:underline transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Tải file mẫu
                  </a>
                </div>
                <p className="text-amber-700 font-mono break-all">STT, Tên, Email, Khối dạy, Cơ sở, Tháng, Số case, Số học sinh, CR45, Loại/Chọn, Thưởng CR</p>
                <p className="text-amber-700/80">Cột cần có để import chính xác: Tên, Email, Tháng, CR45. Ảnh Top 1/2/3 upload riêng ở bên dưới.</p>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-[52px_1.45fr_1.25fr_1fr_0.75fr] gap-2 bg-amber-50/70 px-3 py-2 text-[11px] font-black text-amber-800">
                <span>Top</span>
                <span>Họ tên</span>
                <span>Email</span>
                <span>Cơ sở</span>
                <span>CR45</span>
              </div>
              <div className="divide-y divide-gray-100">
                {manualRows.map((row, index) => (
                  <div key={index} className="grid grid-cols-[52px_1.45fr_1.25fr_1fr_0.75fr] gap-2 px-3 py-3">
                    <div className="flex items-center">
                      <span className={cn(
                        'inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-black',
                        index === 0 ? 'bg-yellow-100 text-yellow-700' : index === 1 ? 'bg-gray-100 text-gray-600' : 'bg-orange-100 text-orange-700'
                      )}>
                        {index + 1}
                      </span>
                    </div>
                    <input
                      value={row.full_name}
                      onChange={e => updateManualRow(index, 'full_name', e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <input
                      value={row.email}
                      onChange={e => updateManualRow(index, 'email', e.target.value)}
                      placeholder="email@mindx.edu.vn"
                      className="min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <input
                      value={row.co_so}
                      onChange={e => updateManualRow(index, 'co_so', e.target.value)}
                      placeholder="Cơ sở"
                      className="min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <input
                      value={row.ti_le}
                      onChange={e => updateManualRow(index, 'ti_le', e.target.value)}
                      placeholder="95"
                      className="min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-sm font-bold tabular-nums outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <div className="col-start-2 col-span-4 grid grid-cols-5 gap-2">
                      <input
                        value={row.khoi_day}
                        onChange={e => updateManualRow(index, 'khoi_day', e.target.value)}
                        placeholder="Khối dạy"
                        className="min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <input
                        value={row.so_case}
                        onChange={e => updateManualRow(index, 'so_case', e.target.value)}
                        placeholder="Số case"
                        className="min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <input
                        value={row.so_hoc_sinh}
                        onChange={e => updateManualRow(index, 'so_hoc_sinh', e.target.value)}
                        placeholder="Số học sinh"
                        className="min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <input
                        value={row.loai}
                        onChange={e => updateManualRow(index, 'loai', e.target.value)}
                        placeholder="Loại"
                        className="min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <input
                        value={row.thuong_cr}
                        onChange={e => updateManualRow(index, 'thuong_cr', e.target.value)}
                        placeholder="Thưởng CR"
                        className="min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload images for Top 3 */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-3">
            <div>
              <p className="text-xs font-bold text-gray-700">Ảnh đại diện Top 3 (tùy chọn)</p>
              <p className="mt-0.5 text-[10px] font-medium text-gray-400">Bấm hoặc rê vào ô Top cần thay ảnh, sau đó dán ảnh từ clipboard.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {/* Top 1 */}
              <div className="space-y-1">
                <p className="text-[10px] font-black text-amber-700 flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Top 1 {top1PasteTarget && <span className="text-[9px] text-amber-500">— Paste ảnh tại đây</span>}
                </p>
                <div
                  role="group"
                  tabIndex={0}
                  aria-label="Vùng dán ảnh đại diện Top 1"
                  onClick={() => focusImagePasteCatcher('top1')}
                  onKeyDown={(e) => handleImageBoxKeyDown(e, 'top1')}
                  onFocus={() => focusImagePasteCatcher('top1')}
                  onMouseEnter={() => setHoveredImageBox('top1')}
                  onMouseLeave={() => setHoveredImageBox(null)}
                  onDragOver={handleImageDragOver}
                  onDrop={(e) => handleImageDrop(e, 'top1')}
                  className={cn(
                    'relative aspect-square rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2',
                    top1Preview
                      ? 'border-amber-300 bg-amber-50'
                      : top1PasteTarget
                      ? 'border-amber-400 bg-amber-100'
                      : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/40'
                  )}
                >
                  <div
                    ref={top1PasteRef}
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck={false}
                    tabIndex={-1}
                    aria-hidden="true"
                    onPaste={(e) => handleImagePaste(e, 'top1')}
                    className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-0 outline-none caret-transparent"
                  />
                  {top1Preview ? (
                    <img src={top1Preview} alt="Top 1" className="relative z-10 w-full h-full object-cover pointer-events-none" />
                  ) : (
                    <div className="relative z-10 flex flex-col items-center gap-1 pointer-events-none">
                      <Upload className="w-5 h-5 text-gray-300" />
                      <span className="text-[9px] font-semibold text-gray-400">Dán ảnh</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openImagePicker('top1') }}
                    className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full border border-amber-200 bg-white/90 px-2 py-0.5 text-[9px] font-black text-amber-700 shadow-sm transition-colors hover:bg-white"
                  >
                    Chọn ảnh
                  </button>
                </div>
                <input
                  id="top1ImageInput"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0], setTop1Image, setTop1Preview)}
                />
              </div>
              {/* Top 2 */}
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-600 flex items-center gap-1">
                  <Medal className="w-3 h-3" /> Top 2 {top2PasteTarget && <span className="text-[9px] text-gray-500">— Paste ảnh tại đây</span>}
                </p>
                <div
                  role="group"
                  tabIndex={0}
                  aria-label="Vùng dán ảnh đại diện Top 2"
                  onClick={() => focusImagePasteCatcher('top2')}
                  onKeyDown={(e) => handleImageBoxKeyDown(e, 'top2')}
                  onFocus={() => focusImagePasteCatcher('top2')}
                  onMouseEnter={() => setHoveredImageBox('top2')}
                  onMouseLeave={() => setHoveredImageBox(null)}
                  onDragOver={handleImageDragOver}
                  onDrop={(e) => handleImageDrop(e, 'top2')}
                  className={cn(
                    'relative aspect-square rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2',
                    top2Preview
                      ? 'border-gray-300 bg-gray-50'
                      : top2PasteTarget
                      ? 'border-gray-400 bg-gray-100'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/40'
                  )}
                >
                  <div
                    ref={top2PasteRef}
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck={false}
                    tabIndex={-1}
                    aria-hidden="true"
                    onPaste={(e) => handleImagePaste(e, 'top2')}
                    className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-0 outline-none caret-transparent"
                  />
                  {top2Preview ? (
                    <img src={top2Preview} alt="Top 2" className="relative z-10 w-full h-full object-cover pointer-events-none" />
                  ) : (
                    <div className="relative z-10 flex flex-col items-center gap-1 pointer-events-none">
                      <Upload className="w-5 h-5 text-gray-300" />
                      <span className="text-[9px] font-semibold text-gray-400">Dán ảnh</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openImagePicker('top2') }}
                    className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full border border-gray-200 bg-white/90 px-2 py-0.5 text-[9px] font-black text-gray-600 shadow-sm transition-colors hover:bg-white"
                  >
                    Chọn ảnh
                  </button>
                </div>
                <input
                  id="top2ImageInput"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0], setTop2Image, setTop2Preview)}
                />
              </div>
              {/* Top 3 */}
              <div className="space-y-1">
                <p className="text-[10px] font-black text-orange-700 flex items-center gap-1">
                  <Medal className="w-3 h-3" /> Top 3 {top3PasteTarget && <span className="text-[9px] text-orange-500">— Paste ảnh tại đây</span>}
                </p>
                <div
                  role="group"
                  tabIndex={0}
                  aria-label="Vùng dán ảnh đại diện Top 3"
                  onClick={() => focusImagePasteCatcher('top3')}
                  onKeyDown={(e) => handleImageBoxKeyDown(e, 'top3')}
                  onFocus={() => focusImagePasteCatcher('top3')}
                  onMouseEnter={() => setHoveredImageBox('top3')}
                  onMouseLeave={() => setHoveredImageBox(null)}
                  onDragOver={handleImageDragOver}
                  onDrop={(e) => handleImageDrop(e, 'top3')}
                  className={cn(
                    'relative aspect-square rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2',
                    top3Preview
                      ? 'border-orange-300 bg-orange-50'
                      : top3PasteTarget
                      ? 'border-orange-400 bg-orange-100'
                      : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/40'
                  )}
                >
                  <div
                    ref={top3PasteRef}
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck={false}
                    tabIndex={-1}
                    aria-hidden="true"
                    onPaste={(e) => handleImagePaste(e, 'top3')}
                    className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-0 outline-none caret-transparent"
                  />
                  {top3Preview ? (
                    <img src={top3Preview} alt="Top 3" className="relative z-10 w-full h-full object-cover pointer-events-none" />
                  ) : (
                    <div className="relative z-10 flex flex-col items-center gap-1 pointer-events-none">
                      <Upload className="w-5 h-5 text-gray-300" />
                      <span className="text-[9px] font-semibold text-gray-400">Dán ảnh</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openImagePicker('top3') }}
                    className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full border border-orange-200 bg-white/90 px-2 py-0.5 text-[9px] font-black text-orange-700 shadow-sm transition-colors hover:bg-white"
                  >
                    Chọn ảnh
                  </button>
                </div>
                <input
                  id="top3ImageInput"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0], setTop3Image, setTop3Preview)}
                />
              </div>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className={cn(
              'rounded-xl p-3 text-sm',
              result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            )}>
              {result.success ? (
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />
                  <div>
                    <p className="font-bold">Import thành công!</p>
                    <p className="text-xs mt-0.5">
                      Đã xoá {result.deleted ?? 0} bản ghi cũ của tháng này và lưu {result.inserted}/{result.total} giáo viên Top 3 mới.
                    </p>
                    {(result.source_total ?? 0) > (result.total ?? 0) && (
                      <p className="text-xs mt-1 text-green-700/80">
                        CSV có {result.source_total} dòng, hệ thống chỉ lấy 3 giáo viên vinh danh đầu bảng.
                      </p>
                    )}
                    {(result.errors?.length ?? 0) > 0 && (
                      <p className="text-xs mt-1 text-amber-700">{result.errors?.length} dòng bị bỏ qua.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <p className="font-semibold">{result.error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button
            variant="mindx"
            size="sm"
            onClick={handleSubmit}
            disabled={(mode === 'csv' && !file) || loading}
            className="gap-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Đang lưu...
              </span>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                {mode === 'csv' ? 'Nhập dữ liệu' : 'Lưu thủ công'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MonthlyHonorsManager() {
  const [showImport, setShowImport] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'podium' | 'table'>('podium')
  const [deleting, setDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const { mutate: mutateGlobal } = useSWRConfig()

  const queryKey = selectedMonth
    ? `/api/truyenthong/vinh-danh?thang=${encodeURIComponent(selectedMonth)}`
    : '/api/truyenthong/vinh-danh'

  const { data, mutate, isLoading } = useSWR<VinhDanhData>(
    showPanel ? queryKey : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  const months = data?.months || []
  const currentMonth = selectedMonth || data?.current_month || ''
  const records = data?.data || []

  const handleDelete = async () => {
    if (!currentMonth) return
    if (!confirm(`Xóa toàn bộ dữ liệu vinh danh tháng ${currentMonth}?`)) return
    setDeleting(true)
    try {
      await fetch(`/api/truyenthong/vinh-danh?thang=${encodeURIComponent(currentMonth)}`, { method: 'DELETE' })
      setSelectedMonth(null)
      mutate()
    } finally {
      setDeleting(false)
    }
  }

  const handleRefreshAvatars = async () => {
    setRefreshing(true)
    try {
      const url = currentMonth
        ? `/api/truyenthong/vinh-danh/refresh-avatars?thang=${encodeURIComponent(currentMonth)}`
        : '/api/truyenthong/vinh-danh/refresh-avatars'
      await fetch(url, { method: 'POST' })
      mutate()
    } finally {
      setRefreshing(false)
    }
  }

  const handleSaveRecord = async (
    id: number,
    values: { full_name: string; co_so: string; ti_le: string },
    avatarFile?: File | null
  ) => {
    if (avatarFile && !avatarFile.type.startsWith('image/')) {
      alert('Chỉ hỗ trợ file ảnh')
      return
    }
    const fd = new FormData()
    fd.append('id', String(id))
    fd.append('full_name', values.full_name)
    fd.append('co_so', values.co_so)
    fd.append('ti_le', values.ti_le)
    if (avatarFile) fd.append('avatar', avatarFile)
    const res = await fetch('/api/truyenthong/vinh-danh', { method: 'PATCH', body: fd })
    const data = await res.json().catch(() => null)
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error || 'Không thể lưu thông tin vinh danh')
    }
    mutateGlobal('/api/truyenthong/top-teachers')
    mutate()
  }

  return (
    <>
      {/* ── Trigger button ── */}
      <Button
        variant="outline"
        className="gap-2 shadow-sm font-semibold border-amber-200 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800 text-amber-700"
        onClick={() => setShowPanel(true)}
      >
        <Trophy className="h-3.5 w-4 text-amber-600" />
        Vinh Danh Tháng
      </Button>

      {/* ── Side Panel ── */}
      {showPanel && (
        <div className="fixed inset-0 z-40 flex" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPanel(false)}
          />

          {/* Drawer */}
          <div className="relative ml-auto w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900">Vinh Danh Giáo Viên Tháng</h2>
                  <p className="text-xs text-gray-500">Quản lý bảng xếp hạng vinh danh theo tháng</p>
                </div>
              </div>
              <button
                onClick={() => setShowPanel(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
                aria-label="Đóng"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50/50 shrink-0">
              {/* View toggle */}
              <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setViewMode('podium')}
                  className={cn('px-3 py-1.5 text-xs font-bold transition-colors', viewMode === 'podium' ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}
                >
                  Top 3
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={cn('px-3 py-1.5 text-xs font-bold transition-colors', viewMode === 'table' ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}
                >
                  Bảng đầy đủ
                </button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {currentMonth && records.length > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshAvatars}
                      disabled={refreshing}
                      className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 text-xs"
                      title="Cập nhật lại ảnh đại diện từ database"
                    >
                      <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
                      Làm mới avatar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 text-xs"
                    >
                      <Trash2 className="w-3 h-3" />
                      Xóa tháng này
                    </Button>
                  </>
                )}
                <Button
                  variant="mindx"
                  size="sm"
                  onClick={() => setShowImport(true)}
                  className="gap-1.5 text-xs"
                >
                  <Upload className="w-3 h-3" />
                  Thêm vinh danh
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
                </div>
              ) : records.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                  <Trophy className="w-14 h-14 text-gray-200 mb-4" />
                  <p className="text-lg font-bold text-gray-400">Chưa có dữ liệu vinh danh</p>
                  <p className="text-sm text-gray-400 mt-1 mb-5">
                    {months.length === 0
                      ? 'Import CSV hoặc nhập thủ công để bắt đầu cập nhật bảng vinh danh'
                      : `Tháng ${currentMonth} chưa có dữ liệu`}
                  </p>
                  <Button variant="mindx" size="sm" onClick={() => setShowImport(true)} className="gap-2">
                    <Plus className="w-3.5 h-3.5" />
                    Thêm dữ liệu vinh danh
                  </Button>
                </div>
              ) : viewMode === 'podium' ? (
                <div className="px-6 py-6">
                  <div className="text-center mb-6">
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200">
                      <Trophy className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-xs font-black tracking-wider text-amber-700 uppercase">
                        Top Giảng Viên Tháng {currentMonth}
                      </span>
                    </span>
                  </div>
                  <PodiumPreview records={records} onSaveRecord={handleSaveRecord} />
                  {records.length > 3 && (
                    <div className="mt-6 text-center">
                      <button
                        onClick={() => setViewMode('table')}
                        className="text-sm text-amber-600 font-bold hover:underline flex items-center gap-1 mx-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Xem tất cả {records.length} giáo viên
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-amber-50/60 border-b border-amber-100">
                      <tr>
                        <th className="px-4 py-3 text-xs font-black text-amber-800 text-center w-14">STT</th>
                        <th className="px-4 py-3 text-xs font-black text-amber-800">Giáo viên</th>
                        <th className="px-4 py-3 text-xs font-black text-amber-800">Cơ sở</th>
                        <th className="px-4 py-3 text-xs font-black text-amber-800">Khối dạy</th>
                        <th className="px-4 py-3 text-xs font-black text-amber-800 text-center">Case</th>
                        <th className="px-4 py-3 text-xs font-black text-amber-800 text-center">HS</th>
                        <th className="px-4 py-3 text-xs font-black text-amber-800 text-center">CR45</th>
                        <th className="px-4 py-3 text-xs font-black text-amber-800">Loại</th>
                        <th className="px-4 py-3 text-xs font-black text-amber-800 text-right">Thưởng CR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {records.map((r, i) => (
                        <HonorRow key={r.id} record={r} index={i} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Import Dialog ── */}
      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onSuccess={(importedMonth) => {
            if (importedMonth) setSelectedMonth(importedMonth)
            mutateGlobal('/api/truyenthong/top-teachers')
            mutateGlobal('/api/truyenthong/vinh-danh')
            mutate()
            setShowImport(false)
          }}
        />
      )}
    </>
  )
}
