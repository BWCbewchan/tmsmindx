'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Edit3,
  FileArchive,
  Flag,
  ImagePlus,
  Plus,
  Save,
  Shirt,
  Sparkles,
  Trash2,
  Trophy,
  UploadCloud,
  Wand2,
  X,
} from 'lucide-react'

type Country = {
  code: string
  flagCode: string
  name: string
  slug: string
  colors: [string, string, string]
}

type MaiOutfit = {
  id: string
  name: string
  countryCode: string
  flagCode?: string
  slug?: string
  colors?: [string, string, string]
  frames: number
  status: 'draft' | 'ready'
  available?: boolean
  color?: string
  bgColor?: string
  sortOrder?: number
  updatedAt: string
}

const COUNTRIES: Country[] = [
  { code: 'VN', flagCode: 'vn', name: 'Việt Nam', slug: 'mascot-vn', colors: ['#da251d', '#ffde00', '#b91c1c'] },
  { code: 'PT', flagCode: 'pt', name: 'Bồ Đào Nha', slug: 'mascot-bdn', colors: ['#006847', '#ffcc00', '#ce1126'] },
  { code: 'BR', flagCode: 'br', name: 'Brazil', slug: 'mascot-bz', colors: ['#009b3a', '#ffdf00', '#002776'] },
  { code: 'FR', flagCode: 'fr', name: 'Pháp', slug: 'mascot-phap', colors: ['#0055a4', '#ffffff', '#ef4135'] },
  { code: 'AR', flagCode: 'ar', name: 'Argentina', slug: 'mascot-argen', colors: ['#74acdf', '#ffffff', '#f6b40e'] },
  { code: 'CA', flagCode: 'ca', name: 'Canada', slug: 'mascot-canada', colors: ['#ff0000', '#ffffff', '#ff0000'] },
  { code: 'MX', flagCode: 'mx', name: 'Mexico', slug: 'mascot-mexico', colors: ['#006847', '#ffffff', '#ce1126'] },
  { code: 'US', flagCode: 'us', name: 'Mỹ', slug: 'mascot-my', colors: ['#3c3b6e', '#ffffff', '#b22234'] },
  { code: 'ZA', flagCode: 'za', name: 'Nam Phi', slug: 'mascot-nam-phi', colors: ['#007a4d', '#ffb81c', '#de3831'] },
  { code: 'KR', flagCode: 'kr', name: 'Hàn Quốc', slug: 'mascot-hq', colors: ['#ffffff', '#c60c30', '#003478'] },
  { code: 'CZ', flagCode: 'cz', name: 'Czechia', slug: 'mascot-czechia', colors: ['#ffffff', '#d7141a', '#11457e'] },
  { code: 'QA', flagCode: 'qa', name: 'Qatar', slug: 'mascot-qatar', colors: ['#8a1538', '#ffffff', '#8a1538'] },
  { code: 'BA', flagCode: 'ba', name: 'Bosnia và Herzegovina', slug: 'mascot-bosnia', colors: ['#002f6c', '#f7d116', '#ffffff'] },
  { code: 'MA', flagCode: 'ma', name: 'Morocco', slug: 'mascot-morocco', colors: ['#c1272d', '#006233', '#c1272d'] },
  { code: 'GB-SCT', flagCode: 'gb-sct', name: 'Scotland', slug: 'mascot-scotland', colors: ['#0065bd', '#ffffff', '#0065bd'] },
  { code: 'HT', flagCode: 'ht', name: 'Haiti', slug: 'mascot-haiti', colors: ['#00209f', '#d21034', '#ffffff'] },
  { code: 'PY', flagCode: 'py', name: 'Paraguay', slug: 'mascot-paraguay', colors: ['#d52b1e', '#ffffff', '#0038a8'] },
  { code: 'AU', flagCode: 'au', name: 'Australia', slug: 'mascot-australia', colors: ['#00008b', '#ffffff', '#ff0000'] },
  { code: 'TR', flagCode: 'tr', name: 'Thổ Nhĩ Kỳ', slug: 'mascot-tho-nhi-ky', colors: ['#e30a17', '#ffffff', '#e30a17'] },
  { code: 'DE', flagCode: 'de', name: 'Đức', slug: 'mascot-duc', colors: ['#000000', '#dd0000', '#ffce00'] },
  { code: 'CW', flagCode: 'cw', name: 'Curaçao', slug: 'mascot-curacao', colors: ['#002b7f', '#f9e814', '#ffffff'] },
  { code: 'CI', flagCode: 'ci', name: 'Bờ Biển Ngà', slug: 'mascot-bo-bien-nga', colors: ['#f77f00', '#ffffff', '#009e60'] },
  { code: 'EC', flagCode: 'ec', name: 'Ecuador', slug: 'mascot-ecuador', colors: ['#ffdd00', '#034ea2', '#ed1c24'] },
  { code: 'ES', flagCode: 'es', name: 'Tây Ban Nha', slug: 'mascot-tbn', colors: ['#aa151b', '#f1bf00', '#aa151b'] },
  { code: 'CV', flagCode: 'cv', name: 'Cape Verde', slug: 'mascot-cape-verde', colors: ['#003893', '#ffffff', '#cf2027'] },
  { code: 'SA', flagCode: 'sa', name: 'Ả Rập Xê Út', slug: 'mascot-saudi', colors: ['#006c35', '#ffffff', '#006c35'] },
  { code: 'UY', flagCode: 'uy', name: 'Uruguay', slug: 'mascot-uruguay', colors: ['#ffffff', '#0038a8', '#fcd116'] },
  { code: 'SN', flagCode: 'sn', name: 'Senegal', slug: 'mascot-senegal', colors: ['#00853f', '#fdef42', '#e31b23'] },
  { code: 'IQ', flagCode: 'iq', name: 'Iraq', slug: 'mascot-iraq', colors: ['#ce1126', '#ffffff', '#000000'] },
  { code: 'NO', flagCode: 'no', name: 'Na Uy', slug: 'mascot-na-uy', colors: ['#ba0c2f', '#ffffff', '#00205b'] },
  { code: 'DZ', flagCode: 'dz', name: 'Algeria', slug: 'mascot-algeria', colors: ['#006233', '#ffffff', '#d21034'] },
  { code: 'AT', flagCode: 'at', name: 'Áo', slug: 'mascot-ao', colors: ['#ed2939', '#ffffff', '#ed2939'] },
  { code: 'JO', flagCode: 'jo', name: 'Jordan', slug: 'mascot-jordan', colors: ['#000000', '#ffffff', '#007a3d'] },
  { code: 'CD', flagCode: 'cd', name: 'DR Congo', slug: 'mascot-dr-congo', colors: ['#007fff', '#f7d618', '#ce1021'] },
  { code: 'UZ', flagCode: 'uz', name: 'Uzbekistan', slug: 'mascot-uzbekistan', colors: ['#1eb4e9', '#ffffff', '#009b3a'] },
  { code: 'CO', flagCode: 'co', name: 'Colombia', slug: 'mascot-colombia', colors: ['#fcd116', '#003893', '#ce1126'] },
  { code: 'GB-ENG', flagCode: 'gb-eng', name: 'England', slug: 'mascot-england', colors: ['#ffffff', '#ce1124', '#ffffff'] },
  { code: 'HR', flagCode: 'hr', name: 'Croatia', slug: 'mascot-croatia', colors: ['#ff0000', '#ffffff', '#171796'] },
  { code: 'GH', flagCode: 'gh', name: 'Ghana', slug: 'mascot-ghana', colors: ['#ce1126', '#fcd116', '#006b3f'] },
  { code: 'PA', flagCode: 'pa', name: 'Panama', slug: 'mascot-panama', colors: ['#ffffff', '#d21034', '#005293'] },
  { code: 'JP', flagCode: 'jp', name: 'Nhật Bản', slug: 'mascot-nhat', colors: ['#ffffff', '#bc002d', '#ffffff'] },
  { code: 'IR', flagCode: 'ir', name: 'Iran', slug: 'mascot-iran', colors: ['#239f40', '#ffffff', '#da0000'] },
  { code: 'NZ', flagCode: 'nz', name: 'New Zealand', slug: 'mascot-new-zealand', colors: ['#00247d', '#ffffff', '#cc142b'] },
]

const INITIAL_OUTFITS: MaiOutfit[] = [
  { id: 'mascot-vn', name: 'Việt Nam', countryCode: 'VN', frames: 25, status: 'ready', updatedAt: '2026-06-21' },
  { id: 'mascot-bdn', name: 'Bồ Đào Nha', countryCode: 'PT', frames: 25, status: 'ready', updatedAt: '2026-06-21' },
  { id: 'mascot-bz', name: 'Brazil', countryCode: 'BR', frames: 25, status: 'ready', updatedAt: '2026-06-21' },
  { id: 'mascot-phap', name: 'Pháp', countryCode: 'FR', frames: 25, status: 'ready', updatedAt: '2026-06-21' },
  { id: 'mascot-argen', name: 'Argentina', countryCode: 'AR', frames: 25, status: 'ready', updatedAt: '2026-06-21' },
]

function getCountry(code: string) {
  return COUNTRIES.find(country => country.code === code) ?? COUNTRIES[0]
}

function FlagPreview({ country, large = false }: { country: Country; large?: boolean }) {
  const size = large ? 'h-12 w-16 rounded-lg' : 'h-8 w-11 rounded-md'
  return (
    <div className={`${size} overflow-hidden border border-black/10 bg-white shadow-sm`}>
      <img
        src={`https://flagcdn.com/${country.flagCode}.svg`}
        alt={`Quốc kỳ ${country.name}`}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  )
}

export default function ManageMaiPage() {
  const [outfits, setOutfits] = useState<MaiOutfit[]>(INITIAL_OUTFITS)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [countryCode, setCountryCode] = useState('VN')
  const [name, setName] = useState('Việt Nam')
  const [files, setFiles] = useState<File[]>([])
  const folderInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadOutfits = async () => {
      try {
        const response = await fetch('/api/mascot-outfits?all=1', { cache: 'no-store' })
        const data = await response.json()
        if (!cancelled && response.ok && data.success && Array.isArray(data.data)) {
          setOutfits(data.data.map((item: any) => ({
            id: item.id,
            name: item.name,
            countryCode: item.countryCode,
            flagCode: item.flagCode,
            slug: item.slug,
            colors: item.colors,
            frames: item.frames,
            status: item.status,
            available: item.available,
            color: item.color,
            bgColor: item.bgColor,
            sortOrder: item.sortOrder,
            updatedAt: String(item.updatedAt ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10),
          })))
        }
      } catch {
        if (!cancelled) setOutfits(INITIAL_OUTFITS)
      }
    }
    loadOutfits()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', 'true')
    folderInputRef.current?.setAttribute('directory', 'true')
  }, [])

  const selectedCountry = useMemo(() => getCountry(countryCode), [countryCode])
  const usedCountryCodes = useMemo(() => new Set(outfits.map(item => item.countryCode)), [outfits])
  const firstAvailableCountry = useMemo(
    () => COUNTRIES.find(country => !usedCountryCodes.has(country.code)) ?? COUNTRIES[0],
    [usedCountryCodes],
  )
  const imageCount = files.filter(file => file.type.startsWith('image/')).length
  const archiveCount = files.filter(file => file.name.toLowerCase().endsWith('.zip')).length

  const resetForm = () => {
    setEditingId(null)
    setCountryCode(firstAvailableCountry.code)
    setName(firstAvailableCountry.name)
    setFiles([])
  }

  const handleCountryChange = (value: string) => {
    if (!editingId && usedCountryCodes.has(value)) return
    const country = getCountry(value)
    setCountryCode(country.code)
    if (!editingId) setName(country.name)
  }

  useEffect(() => {
    if (editingId) return
    if (!usedCountryCodes.has(countryCode)) return
    setCountryCode(firstAvailableCountry.code)
    setName(firstAvailableCountry.name)
  }, [countryCode, editingId, firstAvailableCountry, usedCountryCodes])

  const handleSave = async () => {
    const country = getCountry(countryCode)
    if (!editingId && usedCountryCodes.has(country.code)) return
    const now = new Date().toISOString().slice(0, 10)
    const next: MaiOutfit = {
      id: editingId ?? country.slug,
      name: name.trim() || country.name,
      countryCode: country.code,
      flagCode: country.flagCode,
      slug: editingId ?? country.slug,
      colors: country.colors,
      frames: files.length > 0 ? Math.max(imageCount, files.length) : 25,
      status: 'ready',
      available: true,
      color: country.colors[0],
      bgColor: '#fff5f5',
      sortOrder: editingId ? (outfits.find(item => item.id === editingId)?.sortOrder ?? 100) : Math.max(10, outfits.length * 10 + 10),
      updatedAt: now,
    }

    const response = await fetch('/api/mascot-outfits', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    })
    const data = await response.json()
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Không thể lưu trang phục mascot')
    }

    setOutfits(prev => {
      if (editingId) return prev.map(item => item.id === editingId ? next : item)
      if (prev.some(item => item.id === next.id)) return prev.map(item => item.id === next.id ? next : item)
      return [next, ...prev]
    })
    window.dispatchEvent(new Event('mascot-outfits-refresh'))
    resetForm()
  }

  const handleEdit = (item: MaiOutfit) => {
    setEditingId(item.id)
    setCountryCode(item.countryCode)
    setName(item.name)
    setFiles([])
  }

  const handleDelete = async (id: string) => {
    const response = await fetch(`/api/mascot-outfits?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    const data = await response.json()
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Không thể xóa trang phục mascot')
    }
    setOutfits(prev => prev.filter(item => item.id !== id))
    window.dispatchEvent(new Event('mascot-outfits-refresh'))
    if (editingId === id) resetForm()
  }

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return
    setFiles(Array.from(fileList))
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(16,185,129,0.36),transparent_28%),radial-gradient(circle_at_82%_10%,rgba(239,68,68,0.34),transparent_30%),linear-gradient(135deg,#02140f,#101827_48%,#2b080c)]" />
        <div className="absolute -right-12 top-4 text-[11rem] font-black leading-none text-white/[0.04]">WC</div>
        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-yellow-200">
              <Trophy className="h-4 w-4" />
              World Cup 2026 Mascot Studio
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Quản lý bé Mai</h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-white/72">
              Quản lý trang phục mascot theo quốc gia, chuẩn hóa frame animation và chuẩn bị bộ outfit mới cho modal thay đổi trang phục.
            </p>
          </div>
          <div className="grid min-w-[260px] grid-cols-3 gap-2 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
            <div className="rounded-xl bg-white/10 p-3 text-center">
              <p className="text-2xl font-black">{outfits.length}</p>
              <p className="text-[11px] font-bold uppercase text-white/58">Outfit</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 text-center">
              <p className="text-2xl font-black">{outfits.filter(item => item.status === 'ready').length}</p>
              <p className="text-[11px] font-bold uppercase text-white/58">Sẵn sàng</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 text-center">
              <p className="text-2xl font-black">25</p>
              <p className="text-[11px] font-bold uppercase text-white/58">Frame chuẩn</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-5">
          <div className="flex h-[640px] flex-col rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
            <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Danh sách trang phục</h2>
                <p className="text-sm text-slate-500">Các bộ hiện có và bản nháp admin đang chuẩn bị.</p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                Thêm mới
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
              {outfits.map(item => {
                const country = getCountry(item.countryCode)
                return (
                  <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start gap-3">
                      <FlagPreview country={country} large />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-black text-slate-900">{item.name}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${item.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {item.status === 'ready' ? 'Ready' : 'Draft'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button type="button" onClick={() => handleEdit(item)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100">
                        <Edit3 className="h-4 w-4" />
                        Sửa
                      </button>
                      <button type="button" onClick={() => handleDelete(item.id)} className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-600 transition hover:bg-red-100" aria-label={`Xóa ${item.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>

          <div className="h-[228px] overflow-y-auto rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 text-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-amber-600" />
              <h2 className="font-black">Phương án tối ưu upload frame</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ['1. ZIP khuyến nghị', 'Admin nén 12 hoặc 25 ảnh PNG/WebP vào một file .zip. Server giải nén, sort theo số trong tên file.'],
                ['2. Chuẩn hóa tự động', 'Backend dùng Sharp để remove nền xanh, trim alpha, scale vào canvas 200x200, baseline giống outfit hiện có.'],
                ['3. Xuất asset', 'Tự sinh frame-1..25.png, mascot-*.png preview, mascot-*-sheet.png 1000x1000 và cập nhật metadata outfit.'],
              ].map(([title, body]) => (
                <div key={title} className="rounded-xl border border-amber-200 bg-white/70 p-3">
                  <p className="text-sm font-black text-amber-700">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="h-[640px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Shirt className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-black">{editingId ? 'Sửa trang phục' : 'Thêm trang phục'}</h2>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">Quốc gia</span>
                <select
                  value={countryCode}
                  onChange={event => handleCountryChange(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-100"
                >
                  {COUNTRIES.map(country => {
                    const isUsed = usedCountryCodes.has(country.code) && country.code !== countryCode
                    return (
                      <option key={country.code} value={country.code} disabled={!editingId && isUsed}>
                        {country.name}{!editingId && isUsed ? ' · đã có trang phục' : ''}
                      </option>
                    )
                  })}
                </select>
              </label>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Flag className="h-4 w-4" />
                  Quốc kỳ 
                </div>
                <div className="flex items-center gap-3">
                  <FlagPreview country={selectedCountry} large />
                  <div>
                    <p className="font-black">{selectedCountry.name}</p>
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Tên hiển thị</span>
                <input
                  value={name}
                  onChange={event => setName(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-100"
                  placeholder="Ví dụ: Bồ Đào Nha"
                />
              </label>

              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ImagePlus className="h-5 w-5 text-slate-600" />
                  <div>
                    <p className="text-sm font-black text-slate-800">Thêm hình ảnh frame</p>
                    <p className="text-xs text-slate-500">Hỗ trợ nhiều ảnh, ZIP, hoặc folder ảnh.</p>
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800">
                    <UploadCloud className="h-4 w-4" />
                    Chọn nhiều frame
                    <input hidden multiple type="file" accept="image/png,image/webp,image/jpeg,.zip" onChange={event => handleFiles(event.target.files)} />
                  </label>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100">
                    <FileArchive className="h-4 w-4" />
                    Chọn folder frame
                    <input ref={folderInputRef} hidden multiple type="file" onChange={event => handleFiles(event.target.files)} />
                  </label>
                </div>
                <div className="mt-3 rounded-xl bg-white p-3 text-xs font-semibold text-slate-600">
                  Đã chọn: {files.length} file · {imageCount} ảnh · {archiveCount} zip
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={handleSave} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-red-700">
                  <Save className="h-4 w-4" />
                  {editingId ? 'Lưu sửa' : 'Thêm'}
                </button>
                <button type="button" onClick={resetForm} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100">
                  <X className="h-4 w-4" />
                  Hủy
                </button>
              </div>
            </div>
          </div>

          <div className="h-[228px] overflow-y-auto rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-700" />
              <h2 className="font-black">Checklist khi publish</h2>
            </div>
            {[
              'Có tối thiểu 12 frame hoặc 1 sprite strip sạch nền.',
              'Frame được sort theo số: 1.png, 2.png, 3.png...',
              'Canvas xuất ra 200x200, transparent background.',
              'Sheet xuất 5x5 = 1000x1000 để mascot đã lưu dùng cùng bộ.',
            ].map(item => (
              <div key={item} className="mb-2 flex items-start gap-2 text-sm font-semibold text-emerald-900">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </main>
  )
}
