'use client'

import { useEffect, useState } from 'react'
import { useIsPwa } from '@/components/pwa/use-is-pwa'
import { InstallGate } from '@/components/pwa/install-gate'
import { AccessStart } from './access-start'
import { CheckoutReturn } from './checkout-return'
import { Dashboard } from './dashboard'
import { loadStoredAccount, type StoredMt5Account } from './mt5-session'
import { DerivMark } from './deriv-logo'

function AccessSplash() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
      <DerivMark className="size-14 rounded-2xl text-3xl animate-pulse" />
      <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-muted-foreground">
        SkuD Turbo
      </p>
    </main>
  )
}

export function AccessGate({ preview, checkout }: { preview: boolean; checkout?: string }) {
  const isPwa = useIsPwa()
  const [stored, setStored] = useState<StoredMt5Account | null | undefined>(undefined)

  useEffect(() => {
    if (preview) return
    setStored(loadStoredAccount())
  }, [preview])

  if (preview) return <Dashboard preview />

  // Avoid flashing gated content before client-side detection finishes.
  if (isPwa === null || stored === undefined) return <AccessSplash />

  // Already connected: go straight to the dashboard, even in a plain browser tab.
  if (stored) return <Dashboard />

  // New users must install the PWA before paying or connecting an MT5 account.
  if (!isPwa) return <InstallGate />

  return checkout === 'returned' ? <CheckoutReturn /> : <AccessStart />
}
