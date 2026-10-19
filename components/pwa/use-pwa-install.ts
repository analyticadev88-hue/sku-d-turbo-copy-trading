'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function detectIos() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function detectMobile() {
  if (typeof navigator === 'undefined') return false
  return /android|iphone|ipad|ipod|mobile|webos|blackberry|iemobile|opera mini/i.test(navigator.userAgent)
}

export function usePwaInstall() {
  const [installed, setInstalled] = useState<boolean | undefined>(undefined)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [justInstalled, setJustInstalled] = useState(false)

  useEffect(() => {
    if (isStandaloneDisplay()) {
      setInstalled(true)
      return
    }
    setInstalled(false)

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setJustInstalled(true)
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function promptInstall() {
    if (!deferred) return 'unavailable' as const
    await deferred.prompt()
    const choice = await deferred.userChoice
    if (choice.outcome === 'accepted') {
      setJustInstalled(true)
      setDeferred(null)
    }
    return choice.outcome
  }

  return { installed, canPrompt: deferred !== null, justInstalled, promptInstall }
}
