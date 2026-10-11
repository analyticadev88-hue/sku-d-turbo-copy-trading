'use client'

import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'skud-install-dismissed'

export function PwaProvider() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIos, setShowIos] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    }

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standalone || sessionStorage.getItem(DISMISS_KEY)) return

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setOpen(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    let timer: ReturnType<typeof setTimeout> | undefined
    if (isIos) {
      timer = setTimeout(() => {
        setShowIos(true)
        setOpen(true)
      }, 2500)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      if (timer) clearTimeout(timer)
    }
  }, [])

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setOpen(false)
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-label="Install SkuD Turbo"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-2xl animate-in slide-in-from-bottom-4 fade-in"
    >
      <img src="/icons/icon-192.png" alt="" className="size-12 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">Install SkuD Turbo</p>
        {showIos && !deferred ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Tap <Share className="inline size-3.5 align-[-2px]" aria-label="Share" /> then{' '}
            <span className="font-semibold text-foreground">Add to Home Screen</span>
          </p>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Full-screen app with one-tap access to your robot.
          </p>
        )}
      </div>
      {deferred && (
        <button
          type="button"
          onClick={install}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Download className="size-4" aria-hidden="true" />
          Install
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
