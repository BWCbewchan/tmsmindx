'use client'

import { authHeaders } from '@/lib/auth-headers'
import { useAuth } from '@/lib/auth-context'
import { toast } from '@/lib/app-toast'
import {
  getPushPlatformState,
  isIosUserAgent,
  type PushUnsupportedReason,
  urlBase64ToUint8Array,
} from '@/lib/push-notifications'
import { BellRing, Loader2, Smartphone } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { InstallTpsApp } from './InstallTpsApp'

type DevicePushState = {
  checking: boolean
  busy: boolean
  enabled: boolean
  permission: NotificationPermission | 'unsupported'
  reason: PushUnsupportedReason | null
  publicKey: string
}

const INITIAL_STATE: DevicePushState = {
  checking: true,
  busy: false,
  enabled: false,
  permission: 'unsupported',
  reason: null,
  publicKey: '',
}

function subscriptionPayload(subscription: PushSubscription) {
  const json = subscription.toJSON()
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: json.keys?.p256dh || '',
      auth: json.keys?.auth || '',
    },
  }
}

export function DevicePushSetting() {
  const { token } = useAuth()
  const [state, setState] = useState<DevicePushState>(INITIAL_STATE)

  const inspectSupport = useCallback(async () => {
    setState((current) => ({ ...current, checking: true }))
    try {
      const response = await fetch('/api/push-subscriptions', {
        headers: authHeaders(token),
        cache: 'no-store',
      })
      const data = await response.json()
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể kiểm tra cấu hình Web Push')
      }

      const ios = isIosUserAgent(
        navigator.userAgent,
        navigator.maxTouchPoints || 0,
      )
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
      const platform = getPushPlatformState({
        notificationSupported: 'Notification' in window,
        serviceWorkerSupported: 'serviceWorker' in navigator,
        pushManagerSupported: 'PushManager' in window,
        secureContext: window.isSecureContext,
        ios,
        standalone,
        configured: Boolean(data.configured && data.public_key),
      })

      if (!platform.supported) {
        setState({
          checking: false,
          busy: false,
          enabled: false,
          permission:
            'Notification' in window
              ? Notification.permission
              : 'unsupported',
          reason: platform.reason,
          publicKey: data.public_key || '',
        })
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      })
      await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      setState({
        checking: false,
        busy: false,
        enabled:
          Boolean(subscription) && Notification.permission === 'granted',
        permission: Notification.permission,
        reason: null,
        publicKey: data.public_key,
      })
    } catch (error) {
      console.error('[DevicePushSetting] inspect failed', error)
      setState((current) => ({
        ...current,
        checking: false,
        reason: 'browser-unsupported',
      }))
    }
  }, [token])

  useEffect(() => {
    void inspectSupport()
  }, [inspectSupport])

  const enablePush = async () => {
    if (state.reason || !state.publicKey) return
    if (Notification.permission === 'denied') {
      toast.warning('Quyền thông báo đã bị chặn', {
        message:
          'Mở cài đặt trình duyệt và cho phép thông báo cho trang TPS, sau đó thử lại.',
      })
      setState((current) => ({ ...current, permission: 'denied' }))
      return
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      setState((current) => ({
        ...current,
        enabled: false,
        permission,
      }))
      toast.warning('Bạn chưa cấp quyền thông báo cho TPS')
      return
    }

    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })
    await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    const subscription =
      existing ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          state.publicKey,
        ) as BufferSource,
      }))

    const response = await fetch('/api/push-subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(subscriptionPayload(subscription)),
    })
    const data = await response.json()
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || 'Không thể lưu đăng ký thiết bị')
    }

    setState((current) => ({
      ...current,
      enabled: true,
      permission: 'granted',
    }))
    toast.success('Đã bật thông báo trên thiết bị này')
  }

  const disablePush = async () => {
    const registration = await navigator.serviceWorker.getRegistration('/')
    const subscription = await registration?.pushManager.getSubscription()

    if (subscription) {
      const response = await fetch('/api/push-subscriptions', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })
      const data = await response.json()
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể hủy đăng ký thiết bị')
      }
      await subscription.unsubscribe()
    }

    setState((current) => ({ ...current, enabled: false }))
    toast.success('Đã tắt thông báo trên thiết bị này')
  }

  const togglePush = async () => {
    try {
      setState((current) => ({ ...current, busy: true }))
      if (state.enabled) {
        await disablePush()
      } else {
        await enablePush()
      }
    } catch (error) {
      console.error('[DevicePushSetting] toggle failed', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Không thể thay đổi cài đặt thông báo',
      )
      await inspectSupport()
    } finally {
      setState((current) => ({ ...current, busy: false }))
    }
  }

  const sendTestNotification = async () => {
    try {
      setState((current) => ({ ...current, busy: true }))
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      if (!subscription) throw new Error('Thiết bị chưa được đăng ký')

      const response = await fetch('/api/push-subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          action: 'test',
          endpoint: subscription.endpoint,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể gửi thông báo thử')
      }
      toast.success('Đã gửi thông báo thử tới thiết bị')
    } catch (error) {
      console.error('[DevicePushSetting] test failed', error)
      toast.error(
        error instanceof Error ? error.message : 'Không thể gửi thông báo thử',
      )
    } finally {
      setState((current) => ({ ...current, busy: false }))
    }
  }

  const unavailableMessage = (() => {
    if (state.reason === 'ios-install-required') {
      return 'Hãy cài TPS bằng nút bên trên, sau đó mở TPS từ Màn hình chính để bật thông báo.'
    }
    if (state.reason === 'insecure-context') {
      return 'Thông báo thiết bị chỉ hoạt động trên kết nối HTTPS.'
    }
    if (state.reason === 'not-configured') {
      return 'Máy chủ TPS chưa cấu hình khóa Web Push.'
    }
    if (state.reason === 'browser-unsupported') {
      return 'Trình duyệt này chưa hỗ trợ Web Push. Thông báo trong ứng dụng vẫn hoạt động.'
    }
    if (state.permission === 'denied') {
      return 'Quyền thông báo đang bị chặn trong cài đặt trình duyệt.'
    }
    return null
  })()

  return (
    <div className="page-module__Qo6x2W__settingRow">
      <div className="page-module__Qo6x2W__settingInfo">
        <span className="page-module__Qo6x2W__settingLabel flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-[#a1001f]" />
          Thông báo thiết bị (Điện thoại & Máy tính)
        </span>
        <span className="page-module__Qo6x2W__settingSub">
          Nhận thông báo kể cả khi bạn không mở TPS. Android hỗ trợ trực tiếp;
          iPhone/iPad cần cài TPS vào Màn hình chính.
        </span>

        <InstallTpsApp />

        {typeof unavailableMessage === 'string' ? (
          <span className="mt-2 text-xs font-medium text-amber-700">
            {unavailableMessage}
          </span>
        ) : (
          unavailableMessage
        )}

        {state.enabled ? (
          <button
            onClick={() => void sendTestNotification()}
            disabled={state.busy}
            className="mt-2 inline-flex w-fit items-center gap-1.5 text-xs font-bold text-[#a1001f] hover:underline disabled:opacity-50"
            type="button"
          >
            <BellRing className="h-3.5 w-3.5" />
            Gửi thông báo thử nghiệm
          </button>
        ) : null}
      </div>

      <label
        className={`relative inline-flex min-h-11 items-center ${
          state.reason ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        }`}
      >
        {state.checking || state.busy ? (
          <Loader2 className="mr-3 h-4 w-4 animate-spin text-[#a1001f]" />
        ) : null}
        <input
          type="checkbox"
          className="peer sr-only"
          aria-label="Bật thông báo thiết bị"
          checked={state.enabled}
          disabled={state.checking || state.busy || Boolean(state.reason)}
          onChange={() => void togglePush()}
        />
        <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-3 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#a1001f] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#a1001f]/30 peer-focus-visible:ring-offset-2" />
      </label>
    </div>
  )
}
