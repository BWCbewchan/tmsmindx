'use client'

import { Expand, FileText, Shield } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type SecureTrainingDocumentViewerProps = {
  title: string
  sourceUrl: string
  viewerEmail?: string | null
  className?: string
}

function googleDrivePreviewUrl(url: string) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()

    if (host.includes('drive.google.com')) {
      const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/)
      if (fileMatch?.[1]) {
        return `https://drive.google.com/file/d/${fileMatch[1]}/preview`
      }
      const id = parsed.searchParams.get('id')
      if (id) return `https://drive.google.com/file/d/${id}/preview`
    }

    if (host.includes('docs.google.com')) {
      if (parsed.pathname.includes('/presentation/d/')) {
        return url.replace(/\/edit.*$/, '/embed?start=false&loop=false&delayms=3000')
      }
      if (parsed.pathname.includes('/document/d/') || parsed.pathname.includes('/spreadsheets/d/')) {
        return url.replace(/\/edit.*$/, '/preview')
      }
    }

    return url
  } catch {
    return url
  }
}

export function SecureTrainingDocumentViewer({
  title,
  sourceUrl,
  viewerEmail,
  className = '',
}: SecureTrainingDocumentViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const watermarkRef = useRef<HTMLDivElement>(null)
  const [watermarkTime, setWatermarkTime] = useState(() => new Date().toLocaleString('vi-VN'))
  const [isAway, setIsAway] = useState(false)
  const embedUrl = useMemo(() => googleDrivePreviewUrl(sourceUrl), [sourceUrl])
  const watermarkTiles = useMemo(() => Array.from({ length: 48 }, (_, index) => index), [])
  const watermarkText = `MindX / ${viewerEmail || 'candidate'} / ${watermarkTime}`

  useEffect(() => {
    const onVisibilityChange = () => setIsAway(document.hidden)
    const onBlur = () => setIsAway(true)
    const onFocus = () => setIsAway(false)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => setWatermarkTime(new Date().toLocaleString('vi-VN')), 30000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!rootRef.current || !watermarkRef.current) return
    const observer = new MutationObserver(() => {
      if (!watermarkRef.current || !rootRef.current?.contains(watermarkRef.current)) {
        setIsAway(true)
      }
    })
    observer.observe(rootRef.current, { childList: true, subtree: true, attributes: true })
    return () => observer.disconnect()
  }, [])

  const requestFullscreen = () => {
    void rootRef.current?.requestFullscreen?.()
  }

  return (
    <div
      ref={rootRef}
      className={`relative min-h-[640px] select-none overflow-hidden rounded-lg border border-slate-200 bg-slate-950 text-white shadow-sm ${className}`}
      onCopy={(event) => event.preventDefault()}
      onCut={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <h3 className="truncate text-sm font-bold">{title}</h3>
          </div>
          <p className="mt-1 truncate text-xs text-slate-300">Tài liệu đào tạo đầu vào / Watermark theo phiên xem</p>
        </div>
        <button
          type="button"
          onClick={requestFullscreen}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white hover:bg-white/10"
          aria-label="Xem toàn màn hình"
          title="Xem toàn màn hình"
        >
          <Expand className="h-4 w-4" />
        </button>
      </div>

      <div className={`relative min-h-[584px] bg-slate-100 transition duration-200 ${isAway ? 'blur-md' : ''}`}>
        <iframe
          title={title}
          src={embedUrl}
          className="h-[584px] w-full bg-white"
          sandbox="allow-same-origin allow-scripts allow-forms"
          referrerPolicy="no-referrer"
        />

        <div
          ref={watermarkRef}
          className="pointer-events-none absolute inset-0 z-10 grid grid-cols-3 gap-6 overflow-hidden p-8 opacity-[0.18] mix-blend-multiply sm:grid-cols-4"
          aria-hidden="true"
        >
          {watermarkTiles.map((tile) => (
            <div
              key={tile}
              className="-rotate-12 select-none whitespace-nowrap text-[11px] font-bold uppercase text-rose-900"
              style={{ letterSpacing: '0.16em' }}
            >
              {watermarkText}
            </div>
          ))}
        </div>
      </div>

      {isAway && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/72 backdrop-blur-sm">
          <div className="rounded-lg border border-white/15 bg-slate-900 px-5 py-4 text-center shadow-2xl">
            <Shield className="mx-auto mb-3 h-8 w-8 text-rose-300" />
            <p className="text-sm font-bold text-white">Nội dung tạm ẩn khi cửa sổ mất focus</p>
          </div>
        </div>
      )}
    </div>
  )
}
