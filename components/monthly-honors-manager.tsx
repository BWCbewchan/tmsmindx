'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Trophy, Upload, X, CheckCircle, AlertCircle, ChevronDown, Trash2, Eye, Star, Crown, Medal, Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import useSWR from 'swr'
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

const fetcher = (url: string) => fetch(url).then(r => r.json())

function initials(name: string) {
  const p = name.trim().split(/\s+/)
  return p.length === 1
    ? p[0].slice(0, 2).toUpperCase()
    : (p[p.length - 2][0] + p[p.length - 1][0]).toUpperCase()
}

// ─── Inline editable field ────────────────────────────────────────────────────

function EditableField({
  value, placeholder, onSave, className, inputClassName,
}: {
  value: string; placeholder?: string
  onSave: (val: string) => void
  className?: string; inputClassName?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  const commit = () => { setEditing(false); if (draft.trim() !== value) onSave(draft.trim()) }
  const cancel = () => { setEditing(false); setDraft(value) }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
        className={cn('bg-black/20 border border-white/40 rounded-lg text-center outline-none w-full px-1', inputClassName)}
        placeholder={placeholder}
      />
    )
  }
  return (
    <span
      onClick={() => { setEditing(true); setDraft(value) }}
      title="Click để chỉnh sửa"
      className={cn('cursor-pointer hover:bg-white/10 rounded transition-colors px-1', className)}
    >
      {value || <span className="opacity-40 italic">{placeholder}</span>}
    </span>
  )
}

// ─── Honor Card (preview display) ────────────────────────────────────────────

const DEFAULT_SLOGANS = ['Kiên trì · Không bỏ cuộc', 'Chấp nhận · Làm lại', 'Cải thiện · Tốt hơn']

function HonorCard({
  record, rank, onUpdate,
}: {
  record: HonorRecord; rank: number
  onUpdate?: (field: 'slogan' | 'full_name' | 'co_so', value: string) => void
}) {
  const rankConfigs = [
    { bg: 'from-rose-500 to-pink-600',      badge: 'bg-rose-600',   ring: 'ring-rose-300',   icon: Crown },
    { bg: 'from-indigo-500 to-violet-600',  badge: 'bg-indigo-600', ring: 'ring-indigo-300', icon: Medal },
    { bg: 'from-teal-500 to-emerald-600',   badge: 'bg-teal-600',   ring: 'ring-teal-300',   icon: Medal },
  ]
  const cfg = rankConfigs[rank - 1] || rankConfigs[2]
  const Icon = cfg.icon
  const slogan = record.slogan || DEFAULT_SLOGANS[rank - 1] || ''

  return (
    <div className={cn(
      'relative flex flex-col items-center rounded-2xl p-4 text-white shadow-lg transition-transform hover:-translate-y-0.5',
      'bg-gradient-to-br', cfg.bg,
      rank === 1 ? 'w-[210px] min-h-[270px]' : 'w-[190px] min-h-[248px]'
    )}>
      {/* rank badge */}
      <div className={cn('absolute top-2.5 left-2.5 rounded-lg px-2 py-0.5 text-[10px] font-black', cfg.badge)}>
        #{rank}
      </div>
      {rank === 1 && <Icon className="absolute top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 text-white/80" />}

      {/* Avatar */}
      <div className={cn(
        'rounded-full overflow-hidden flex items-center justify-center shrink-0 ring-2',
        cfg.ring,
        rank === 1 ? 'w-[76px] h-[76px] mt-6' : 'w-[62px] h-[62px] mt-4'
      )}>
        {record.avatar_url ? (
          <img src={record.avatar_url} alt={record.full_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-white/20 flex items-center justify-center">
            <span className={cn('font-black text-white', rank === 1 ? 'text-xl' : 'text-base')}>
              {initials(record.full_name)}
            </span>
          </div>
        )}
      </div>

      {/* Info — editable khi có onUpdate */}
      <div className="mt-3 flex flex-col items-center text-center gap-1 flex-1 w-full px-1">
        {onUpdate ? (
          <EditableField
            value={record.full_name}
            placeholder="Họ và tên"
            onSave={v => onUpdate('full_name', v)}
            className={cn('font-black leading-snug block w-full', rank === 1 ? 'text-[14px]' : 'text-[13px]')}
            inputClassName={cn('font-black text-white', rank === 1 ? 'text-[14px]' : 'text-[13px]')}
          />
        ) : (
          <p className={cn('font-black leading-snug', rank === 1 ? 'text-[14px]' : 'text-[13px]')}>
            {record.full_name}
          </p>
        )}

        {onUpdate ? (
          <EditableField
            value={record.co_so || ''}
            placeholder="Cơ sở"
            onSave={v => onUpdate('co_so', v)}
            className="text-white/80 font-medium text-[10px] block w-full"
            inputClassName="text-[10px] text-white"
          />
        ) : (
          <p className="text-white/80 font-medium text-[10px]" style={{ wordBreak: 'break-word' }}>
            {record.co_so || '—'}
          </p>
        )}

        {/* Tỉ lệ */}
        <div className="flex items-center gap-1.5 bg-black/30 rounded-xl px-3 py-1.5 mt-1 border border-white/15">
          <Star className="w-3 h-3 fill-yellow-300 text-yellow-300 shrink-0" />
          <span className={cn('font-black tabular-nums', rank === 1 ? 'text-[15px]' : 'text-[13px]')}>
            {record.ti_le.toFixed(1)}%
          </span>
        </div>

        {/* Slogan — editable */}
        <div className="w-full bg-black/30 rounded-xl px-2 py-1.5 mt-1 border border-white/10">
          {onUpdate ? (
            <EditableField
              value={slogan}
              placeholder="Nhập slogan..."
              onSave={v => onUpdate('slogan', v)}
              className="font-black text-white/90 text-[8px] uppercase tracking-wider block w-full text-center"
              inputClassName="font-black text-[8px] uppercase text-white"
            />
          ) : (
            <span className="font-black text-white/90 text-[8px] uppercase tracking-wider text-center block">
              {slogan}
            </span>
          )}
        </div>

        {onUpdate && (
          <p className="text-white/40 text-[8px] mt-0.5">✎ click text để sửa</p>
        )}
      </div>
    </div>
  )
}

// ─── Podium Preview ───────────────────────────────────────────────────────────

function PodiumPreview({
  records, onUpdateRecord,
}: {
  records: HonorRecord[]
  onUpdateRecord?: (id: number, field: 'slogan' | 'full_name' | 'co_so', value: string) => void
}) {
  const top3 = records.slice(0, 3)
  const podium = [top3[1], top3[0], top3[2]].filter(Boolean) as HonorRecord[]
  const podiumRanks = [2, 1, 3]

  return (
    <div className="flex items-end justify-center gap-3">
      {podium.map((r, i) => (
        <HonorCard
          key={r.id}
          record={r}
          rank={podiumRanks[i]}
          onUpdate={onUpdateRecord ? (field, val) => onUpdateRecord(r.id, field, val) : undefined}
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
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 rounded-lg px-2 py-0.5 text-xs font-black">
          <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
          {record.ti_le.toFixed(1)}%
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
  errors?: string[]
  preview?: Record<string, unknown>[]
  error?: string
}

function ImportDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [thang, setThang] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Track which image box is hovered for paste
  const [hoveredImageBox, setHoveredImageBox] = useState<string | null>(null)
  // Images for top 1, 2, 3
  const [top1Image, setTop1Image] = useState<File | null>(null)
  const [top2Image, setTop2Image] = useState<File | null>(null)
  const [top3Image, setTop3Image] = useState<File | null>(null)
  const [top1Preview, setTop1Preview] = useState<string | null>(null)
  const [top2Preview, setTop2Preview] = useState<string | null>(null)
  const [top3Preview, setTop3Preview] = useState<string | null>(null)

  const handleFile = (f: File) => {
    if (!f.name.endsWith('.csv')) {
      alert('Chỉ hỗ trợ file CSV')
      return
    }
    setFile(f)
    setResult(null)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  const handleImageSelect = (
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
  }

  // Handle paste event
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const items = e.clipboardData.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file && hoveredImageBox) {
          if (hoveredImageBox === 'top1') {
            handleImageSelect(file, setTop1Image, setTop1Preview)
          } else if (hoveredImageBox === 'top2') {
            handleImageSelect(file, setTop2Image, setTop2Preview)
          } else if (hoveredImageBox === 'top3') {
            handleImageSelect(file, setTop3Image, setTop3Preview)
          }
        }
      }
    }
  }, [hoveredImageBox])

  // Handle drag event for image boxes
  const handleImageDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // Handle drop event for image boxes
  const handleImageDrop = (e: React.DragEvent, box: string) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      if (box === 'top1') {
        handleImageSelect(file, setTop1Image, setTop1Preview)
      } else if (box === 'top2') {
        handleImageSelect(file, setTop2Image, setTop2Preview)
      } else if (box === 'top3') {
        handleImageSelect(file, setTop3Image, setTop3Preview)
      }
    }
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (thang) fd.append('thang', thang)
      if (top1Image) fd.append('top1Image', top1Image)
      if (top2Image) fd.append('top2Image', top2Image)
      if (top3Image) fd.append('top3Image', top3Image)
      const res = await fetch('/api/truyenthong/vinh-danh/import', { method: 'POST', body: fd })
      const data: ImportResult = await res.json()
      setResult(data)
      if (data.success && (data.inserted ?? 0) > 0) {
        setTimeout(() => { onSuccess(); onClose() }, 1800)
      }
    } catch {
      setResult({ success: false, error: 'Lỗi kết nối máy chủ' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        onPaste={handlePaste}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">Cập nhật Vinh Danh Tháng</h2>
              <p className="text-xs text-gray-500">Import dữ liệu giáo viên từ file CSV</p>
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

        <div className="px-6 py-5 space-y-4">
          {/* Tháng override */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">
              Tháng (để trống nếu file đã có cột tháng)
            </label>
            <input
              type="text"
              value={thang}
              onChange={e => setThang(e.target.value)}
              placeholder="vd: 06/2025"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>

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
            <p className="text-amber-700 font-mono break-all">STT, Tên, Email, Khối dạy, Cơ sở, Tháng, Số case, Số học sinh, Tỉ lệ, Loại/Chọn, Thưởng CR</p>
          </div>

          {/* Upload images for Top 3 */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-3">
            <p className="text-xs font-bold text-gray-700">Ảnh đại diện Top 3 (tùy chọn)</p>
            <div className="grid grid-cols-3 gap-3">
              {/* Top 1 */}
              <div className="space-y-1">
                <p className="text-[10px] font-black text-amber-700 flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Top 1 {hoveredImageBox === 'top1' && <span className="text-[9px] text-amber-500">— Paste ảnh tại đây</span>}
                </p>
                <div
                  onClick={() => document.getElementById('top1ImageInput')?.click()}
                  onMouseEnter={() => setHoveredImageBox('top1')}
                  onMouseLeave={() => setHoveredImageBox(null)}
                  onDragOver={handleImageDragOver}
                  onDrop={(e) => handleImageDrop(e, 'top1')}
                  className={cn(
                    'aspect-square rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden',
                    top1Preview
                      ? 'border-amber-300 bg-amber-50'
                      : hoveredImageBox === 'top1'
                      ? 'border-amber-400 bg-amber-100'
                      : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/40'
                  )}
                >
                  {top1Preview ? (
                    <img src={top1Preview} alt="Top 1" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-5 h-5 text-gray-300" />
                  )}
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
                  <Medal className="w-3 h-3" /> Top 2 {hoveredImageBox === 'top2' && <span className="text-[9px] text-gray-500">— Paste ảnh tại đây</span>}
                </p>
                <div
                  onClick={() => document.getElementById('top2ImageInput')?.click()}
                  onMouseEnter={() => setHoveredImageBox('top2')}
                  onMouseLeave={() => setHoveredImageBox(null)}
                  onDragOver={handleImageDragOver}
                  onDrop={(e) => handleImageDrop(e, 'top2')}
                  className={cn(
                    'aspect-square rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden',
                    top2Preview
                      ? 'border-gray-300 bg-gray-50'
                      : hoveredImageBox === 'top2'
                      ? 'border-gray-400 bg-gray-100'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/40'
                  )}
                >
                  {top2Preview ? (
                    <img src={top2Preview} alt="Top 2" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-5 h-5 text-gray-300" />
                  )}
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
                  <Medal className="w-3 h-3" /> Top 3 {hoveredImageBox === 'top3' && <span className="text-[9px] text-orange-500">— Paste ảnh tại đây</span>}
                </p>
                <div
                  onClick={() => document.getElementById('top3ImageInput')?.click()}
                  onMouseEnter={() => setHoveredImageBox('top3')}
                  onMouseLeave={() => setHoveredImageBox(null)}
                  onDragOver={handleImageDragOver}
                  onDrop={(e) => handleImageDrop(e, 'top3')}
                  className={cn(
                    'aspect-square rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden',
                    top3Preview
                      ? 'border-orange-300 bg-orange-50'
                      : hoveredImageBox === 'top3'
                      ? 'border-orange-400 bg-orange-100'
                      : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/40'
                  )}
                >
                  {top3Preview ? (
                    <img src={top3Preview} alt="Top 3" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-5 h-5 text-gray-300" />
                  )}
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
                    <p className="text-xs mt-0.5">Đã nhập {result.inserted}/{result.total} bản ghi.</p>
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
            onClick={handleImport}
            disabled={!file || loading}
            className="gap-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Đang import...
              </span>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                Nhập dữ liệu
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

  const handleMonthChange = (m: string) => {
    setSelectedMonth(m)
  }

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

  const handleUpdateRecord = async (id: number, field: 'slogan' | 'full_name' | 'co_so', value: string) => {
    await fetch('/api/truyenthong/vinh-danh', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: value }),
    })
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
              {/* Month picker */}
              <div className="relative">
                <select
                  value={currentMonth}
                  onChange={e => handleMonthChange(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-1.5 text-sm font-semibold border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                >
                  {months.length === 0 && <option value="">— Chưa có dữ liệu —</option>}
                  {months.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>

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
                  Import CSV
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
                      ? 'Import file CSV để bắt đầu cập nhật bảng vinh danh'
                      : `Tháng ${currentMonth} chưa có dữ liệu`}
                  </p>
                  <Button variant="mindx" size="sm" onClick={() => setShowImport(true)} className="gap-2">
                    <Upload className="w-3.5 h-3.5" />
                    Import dữ liệu CSV
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
                  <PodiumPreview records={records} onUpdateRecord={handleUpdateRecord} />
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
                        <th className="px-4 py-3 text-xs font-black text-amber-800 text-center">Tỉ lệ</th>
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
          onSuccess={() => { mutate(); setShowImport(false) }}
        />
      )}
    </>
  )
}
