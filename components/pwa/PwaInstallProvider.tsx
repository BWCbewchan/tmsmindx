'use client'

import { isIosUserAgent } from '@/lib/push-notifications'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

type InstallChoice = {
  outcome: 'accepted' | 'dismissed'
  platform: string
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<InstallChoice>
}

type PwaInstallContextValue = {
  ready: boolean
  installed: boolean
  ios: boolean
  promptAvailable: boolean
  requestInstall: () => Promise<InstallChoice | null>
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null)

function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

export function PwaInstallProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [ready, setReady] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    setInstalled(isStandaloneMode())
    setIos(
      isIosUserAgent(navigator.userAgent, navigator.maxTouchPoints || 0),
    )
    setReady(true)
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(
        (error) => {
          console.warn('[PwaInstallProvider] service worker registration failed', error)
        },
      )
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const handleInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
    }
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const handleDisplayModeChange = () => setInstalled(isStandaloneMode())

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    displayMode.addEventListener('change', handleDisplayModeChange)

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      )
      window.removeEventListener('appinstalled', handleInstalled)
      displayMode.removeEventListener('change', handleDisplayModeChange)
    }
  }, [])

  const requestInstall = useCallback(async () => {
    if (!installPrompt) return null
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallPrompt(null)
    return choice
  }, [installPrompt])

  const value = useMemo(
    () => ({
      ready,
      installed,
      ios,
      promptAvailable: Boolean(installPrompt),
      requestInstall,
    }),
    [installed, installPrompt, ios, ready, requestInstall],
  )

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
    </PwaInstallContext.Provider>
  )
}

export function usePwaInstall() {
  const context = useContext(PwaInstallContext)
  if (!context) {
    throw new Error('usePwaInstall must be used within PwaInstallProvider')
  }
  return context
}
