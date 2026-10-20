'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { AccessFlow } from './access-flow'
import { AccessStart } from './access-start'
import { Dashboard } from './dashboard'
import { GetStarted } from './get-started'
import { InstallRequired } from './install-required'
import { clearClientSessionId, loadClientSessionId } from './client-session'
import { loadStoredAccount, type StoredMt5Account } from './mt5-session'
import { usePwaInstall } from '@/components/pwa/use-pwa-install'
import { getBrowserSupabase } from '@/lib/supabase'

function AccessSplash() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0b0b0d] text-white">
      <Image src="/logo-synth.webp" alt="SkuD Turbo" width={72} height={72} priority className="size-16 animate-pulse rounded-2xl object-cover" />
      <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-white/65">
        SkuD Turbo
      </p>
    </main>
  )
}

const PAYMENT_ORDER_KEY = 'skud-payment-order'

type AccessState = 'pending' | 'approved' | 'rejected' | 'expired' | 'payment_required' | 'superseded' | 'error'

function SignedOutElsewhere() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center gap-4 overflow-hidden bg-[#0b0b0d] px-5 text-center text-white">
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_15%,rgba(255,68,79,0.12),transparent_48%)]"
        aria-hidden="true"
      />
      <Image src="/logo-synth.webp" alt="SkuD Turbo" width={72} height={72} priority className="size-16 rounded-2xl object-cover" />
      <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-white/75">SkuD Turbo</p>
      <h1 className="mt-2 text-2xl font-extrabold">Signed in on another device</h1>
      <p className="max-w-sm text-sm leading-relaxed text-white/55">
        This account was used to sign in somewhere else. For your security, only one device can be
        active at a time.
      </p>
      <button
        type="button"
        onClick={async () => {
          clearClientSessionId()
          await getBrowserSupabase().auth.signOut()
          window.location.assign('/dashboard?login=1')
        }}
        className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-extrabold text-white transition-colors hover:bg-primary/85"
      >
        Sign in again
      </button>
    </main>
  )
}

export function AccessGate({ preview, checkout, login }: { preview: boolean; checkout?: string; login?: boolean }) {
  const [access, setAccess] = useState<AccessState | null | undefined>(undefined)
  const [orderId, setOrderId] = useState<string | undefined>()
  const [stored, setStored] = useState<StoredMt5Account | null>(null)
  const { installed } = usePwaInstall()

  useEffect(() => {
    if (preview) return

    const query = new URLSearchParams(window.location.search)
    const queryOrder = query.get('order_id') ?? undefined
    const savedOrder = window.localStorage.getItem(PAYMENT_ORDER_KEY) ?? undefined
    const activeOrder = queryOrder ?? savedOrder
    setOrderId(activeOrder)

    let active = true
    async function loadAccess() {
      try {
        const { data } = await getBrowserSupabase().auth.getSession()
        const token = data.session?.access_token
        if (!token) {
          if (active) setAccess(null)
          return
        }

        const response = await fetch('/api/access', {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-session-id': loadClientSessionId() ?? '',
          },
          cache: 'no-store',
        })
        const result = await response.json() as { status?: AccessState; error?: string }
        if (!response.ok) throw new Error(result.error ?? 'Could not verify subscription access.')
        if (!active) return
        setAccess(result.status ?? 'error')
        if (result.status === 'approved') setStored(loadStoredAccount())
      } catch {
        if (active) setAccess('error')
      }
    }

    void loadAccess()
    return () => { active = false }
  }, [preview])

  if (preview) return <Dashboard preview />

  if (installed === undefined || access === undefined) return <AccessSplash />

  if (!installed && checkout !== 'returned') return <InstallRequired />

  if (access === 'superseded') return <SignedOutElsewhere />

  if (access === 'error') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-5 text-center">
        <p className="text-lg font-bold">Could not verify account access.</p>
        <button type="button" onClick={() => window.location.reload()} className="rounded-md border border-border px-4 py-2 text-sm font-bold">
          Try again
        </button>
      </main>
    )
  }

  if (access === 'approved') return stored ? <Dashboard /> : <GetStarted />
  if (access === 'pending' || access === 'rejected') {
    return <AccessFlow initialAccessStatus={access} orderId={orderId} />
  }
  if (access === 'payment_required' && !orderId) {
    return <AccessFlow initialAccessStatus="payment_required" />
  }
  if (orderId && (checkout === 'returned' || access === null || access === 'payment_required' || access === 'expired')) {
    return <AccessFlow orderId={orderId} />
  }
  if (login) return <AccessFlow loginOnly />
  if (access === 'expired') return <AccessStart />
  return <AccessFlow loginOnly />
}
