'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { AccessFlow } from './access-flow'
import { AccessStart } from './access-start'
import { AdminApp } from './admin-app'
import { Dashboard } from './dashboard'
import { GetStarted } from './get-started'
import { MentorApp } from './mentor-app'
import { loadStoredAccount, type StoredMt5Account } from './mt5-session'
import { getBrowserSupabase } from '@/lib/supabase'

function AccessSplash() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0b0b0d] text-white">
      <Image src="/logo-synth.webp" alt="Synthyard EA Hosting" width={72} height={72} priority className="size-16 animate-pulse rounded-2xl object-cover" />
      <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-white/65">
        Synthyard EA Hosting
      </p>
    </main>
  )
}

const PAYMENT_ORDER_KEY = 'skud-payment-order'

type AccessState = 'pending' | 'approved' | 'rejected' | 'expired' | 'payment_required' | 'error'

export function AccessGate({ preview, checkout, login }: { preview: boolean; checkout?: string; login?: boolean }) {
  const [access, setAccess] = useState<AccessState | null | undefined>(undefined)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mentorId, setMentorId] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | undefined>()
  const [stored, setStored] = useState<StoredMt5Account | null>(null)

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
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const result = await response.json() as { status?: AccessState; isAdmin?: boolean; mentorId?: string | null; error?: string }
        if (!response.ok) throw new Error(result.error ?? 'Could not verify subscription access.')
        if (!active) return
        setAccess(result.status ?? 'error')
        setIsAdmin(result.isAdmin === true)
        setMentorId(typeof result.mentorId === 'string' && result.mentorId ? result.mentorId : null)
        if (result.status === 'approved') setStored(loadStoredAccount())
      } catch {
        if (active) setAccess('error')
      }
    }

    void loadAccess()
    return () => { active = false }
  }, [preview])

  if (preview) return <Dashboard preview />

  if (access === undefined) return <AccessSplash />

  if (isAdmin) return <AdminApp />

  if (mentorId) return <MentorApp mentorId={mentorId} />

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
  if (orderId && (checkout === 'returned' || access === null || access === 'payment_required' || access === 'expired')) {
    return <AccessFlow orderId={orderId} />
  }
  if (login) return <AccessFlow loginOnly />
  if (access === 'expired') return <AccessStart />
  return <AccessStart />
}
