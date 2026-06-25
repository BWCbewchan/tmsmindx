'use client'

import { usePwaInstall } from '@/components/pwa/PwaInstallProvider'
import { toast } from '@/lib/app-toast'
import { getPwaInstallState } from '@/lib/pwa-install'
import {
  CheckCircle2,
  Download,
  Loader2,
  Smartphone,
} from 'lucide-react'
import { useState } from 'react'

export function InstallTpsApp({
  compact = false,
  hideWhenInstalled = false,
}: {
  compact?: boolean
  hideWhenInstalled?: boolean
} = {}) {
  const { ready, installed, ios, promptAvailable, requestInstall } =
    usePwaInstall()
  const [busy, setBusy] = useState(false)
  const installState = getPwaInstallState({
    installed,
    ios,
    promptAvailable,
  })

  const handleInstall = async () => {
    if (installState !== 'prompt') {
      if (ios) {
        toast.info('Cài TPS trên iPhone/iPad', {
          message:
            'Nhấn Chia sẻ, chọn Thêm vào Màn hình chính, rồi nhấn Thêm. Nếu không thấy mục này, hãy mở trang TPS bằng Safari.',
          duration: 7000,
        })
      } else {
        toast.info('Cài TPS từ menu trình duyệt', {
          message:
            'Mở menu Chrome hoặc Edge, chọn Cài đặt ứng dụng hoặc Thêm vào màn hình chính, rồi xác nhận Cài đặt.',
          duration: 7000,
        })
      }
      return
    }

    try {
      setBusy(true)
      const choice = await requestInstall()
      if (choice?.outcome === 'accepted') {
        toast.success('Đang cài TPS vào màn hình chính')
      } else {
        toast.warning('Bạn đã hủy cài đặt TPS')
      }
    } catch (error) {
      console.error('[InstallTpsApp] install failed', error)
      toast.error('Không thể mở hộp cài đặt', {
        message:
          'Mở menu Chrome hoặc Edge, chọn Cài đặt ứng dụng hoặc Thêm vào màn hình chính.',
      })
    } finally {
      setBusy(false)
    }
  }

  if (hideWhenInstalled && (!ready || installState === 'installed')) {
    return null
  }

  if (installState === 'installed') {
    return (
      <div className="mt-3 flex w-fit items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
        <CheckCircle2 className="h-4 w-4" />
        TPS đã được cài trên thiết bị này
      </div>
    )
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void handleInstall()}
        disabled={busy}
        className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f]/40 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${
          compact
            ? 'border border-[#a1001f]/20 bg-[#fff6f7] text-[#8c001b] hover:border-[#a1001f]/35 hover:bg-[#fdebee]'
            : 'bg-[#a1001f] text-white hover:bg-[#86001a] sm:w-auto'
        }`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : installState === 'prompt' ? (
          <Download className="h-4 w-4" />
        ) : (
          <Smartphone className="h-4 w-4" />
        )}
        {installState === 'prompt'
          ? 'Cài TPS vào màn hình chính'
          : ios
            ? 'Cài TPS trên iPhone/iPad'
            : 'Hướng dẫn cài TPS'}
      </button>

      <p className={compact ? 'sr-only' : 'mt-2 text-[11px] leading-4 text-gray-500'}>
        Trình duyệt yêu cầu bạn bấm xác nhận cài đặt; TPS không thể tự cài âm
        thầm lên thiết bị.
      </p>
    </div>
  )
}
