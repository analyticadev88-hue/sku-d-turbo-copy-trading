'use client'

import { useCallback, useEffect, useState } from 'react'
import { CreditCard, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getBrowserSupabase } from '@/lib/supabase'

type ServerPaySummary = {
  unpaidCount: number
  threshold: number
  pricePerStudent: number
  whopUrl: string
  batchSize: number
  totalDue: number
  showModal: boolean
}

const DISMISS_KEY = 'skud-server-pay-dismissed'

export function ServerPayModal() {
  const [summary, setSummary] = useState<ServerPaySummary | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      const { data } = await getBrowserSupabase().auth.getSession()
      const token = data.session?.access_token
      if (!token) return
      const response = await fetch('/api/admin/server-pay', {
        headers: { 'x-supabase-access-token': token },
        cache: 'no-store',
      })
      if (!response.ok) return
      setSummary(await response.json() as ServerPaySummary)
    } catch {
      // Keep the dashboard usable when the check fails; it retries on interval.
    }
  }, [])

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1')
    void load()
    const timer = setInterval(load, 30_000)
    return () => clearInterval(timer)
  }, [load])

  const markPaid = async () => {
    setBusy(true)
    setMessage('')
    try {
      const { data } = await getBrowserSupabase().auth.getSession()
      const token = data.session?.access_token
      if (!token) return
      const response = await fetch('/api/admin/server-pay', {
        method: 'POST',
        headers: { 'x-supabase-access-token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ markPaid: true }),
      })
      const body = await response.json().catch(() => null) as { marked?: number; error?: string } | null
      if (!response.ok || !body) {
        setMessage(body?.error ?? 'Could not mark the batch as paid.')
        return
      }
      sessionStorage.removeItem(DISMISS_KEY)
      setDismissed(false)
      await load()
      setMessage(`${body.marked ?? 0} students marked as paid.`)
    } finally {
      setBusy(false)
    }
  }

  if (!summary?.showModal || dismissed) return null

  return (
    <Dialog open onOpenChange={(open) => { if (!open) {
      sessionStorage.setItem(DISMISS_KEY, '1')
      setDismissed(true)
    } }}>
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-0 right-0 max-h-[88dvh] w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-t-2xl border-white/10 bg-[#111114] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:right-auto sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:p-6"
      >
        <DialogHeader className="items-center text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Users className="size-6" aria-hidden="true" />
          </span>
          <DialogTitle className="text-xl font-extrabold text-white">Server payment due</DialogTitle>
          <DialogDescription className="text-white/55">
            {summary.unpaidCount} approved students are covered by the mentor&rsquo;s one-off server payment.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 divide-y divide-white/10 border-y border-white/10 text-sm">
          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-white/55">Students in this batch</span>
            <span className="font-mono font-semibold">{summary.batchSize} × ${summary.pricePerStudent}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-white/55">Total due</span>
            <span className="font-mono font-extrabold">${summary.totalDue.toFixed(2)}</span>
          </div>
        </div>
        {summary.whopUrl ? (
          <a
            href={summary.whopUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-xs font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary/85"
          >
            <CreditCard className="size-4" aria-hidden="true" />
            Pay ${summary.totalDue.toFixed(2)} on Whop
          </a>
        ) : (
          <p className="mt-4 text-xs leading-relaxed text-white/45">
            Add WHOP_PAYMENT_URL to the server environment to link this batch to a Whop checkout.
          </p>
        )}
        <button
          type="button"
          onClick={markPaid}
          disabled={busy}
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-white/15 px-4 text-xs font-extrabold uppercase tracking-[0.1em] text-white/80 transition-colors hover:bg-white/5 disabled:opacity-60"
        >
          {busy ? 'Marking…' : 'Payment sent — mark batch as paid'}
        </button>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, '1')
            setDismissed(true)
          }}
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center px-4 text-xs font-bold uppercase tracking-[0.1em] text-white/45 transition-colors hover:text-white"
        >
          Later
        </button>
        {message && <p role="status" className="mt-2 text-center text-xs text-white/55">{message}</p>}
      </DialogContent>
    </Dialog>
  )
}
