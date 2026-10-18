'use client'

import { useEffect } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaProvider() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()
      const installWindow = window as Window & { __skudInstallPrompt?: BeforeInstallPromptEvent }
      installWindow.__skudInstallPrompt = e as BeforeInstallPromptEvent
      window.dispatchEvent(new Event('skud-install-available'))
    }
    const onInstalled = () => {
      const installWindow = window as Window & { __skudInstallPrompt?: BeforeInstallPromptEvent }
      delete installWindow.__skudInstallPrompt
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  return null
}
