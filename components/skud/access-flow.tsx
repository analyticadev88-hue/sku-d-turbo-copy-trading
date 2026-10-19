'use client'

import Image from 'next/image'
import { useEffect, useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase'
import { DerivMark } from './deriv-logo'
import { SynthyardCheckoutDialog } from './synthyard-checkout'
import { clearClientSessionId, loadClientSessionId, saveClientSessionId } from './client-session'

type AccessStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'payment_required' | 'superseded'

export function AccessFlow({
  orderId,
  initialAccessStatus,
  loginOnly = false,
}: {
  orderId?: string
  initialAccessStatus?: AccessStatus
  loginOnly?: boolean
}) {
  const [paymentStatus, setPaymentStatus] = useState<'checking' | 'pending' | 'paid' | 'failed'>(
    orderId ? 'checking' : 'paid',
  )
  const [mode, setMode] = useState<'signup' | 'login'>(loginOnly || !orderId ? 'login' : 'signup')
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(initialAccessStatus ?? null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  async function checkPayment() {
    if (!orderId) return
    try {
      const response = await fetch(`/api/payments/status?order_id=${encodeURIComponent(orderId)}`, {
        cache: 'no-store',
      })
      const result = await response.json() as { status?: string; error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Could not check payment status.')
      if (result.status === 'PAID') setPaymentStatus('paid')
      else if (result.status === 'FAILED') {
        window.localStorage.removeItem('skud-payment-order')
        setPaymentStatus('failed')
      } else {
        setPaymentStatus('pending')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not check payment status.')
    }
  }

  useEffect(() => {
    if (!orderId) return
    const currentOrderId = orderId
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    async function poll() {
      try {
        const response = await fetch(`/api/payments/status?order_id=${encodeURIComponent(currentOrderId)}`, {
          cache: 'no-store',
        })
        const result = await response.json() as { status?: string; error?: string }
        if (!response.ok) throw new Error(result.error ?? 'Could not check payment status.')
        if (!active) return
        if (result.status === 'PAID') setPaymentStatus('paid')
        else if (result.status === 'FAILED') {
          window.localStorage.removeItem('skud-payment-order')
          setPaymentStatus('failed')
        }
        else {
          setPaymentStatus('pending')
          timer = setTimeout(poll, 4000)
        }
      } catch (error) {
        if (!active) return
        setPaymentStatus('pending')
        setMessage(error instanceof Error ? error.message : 'Could not check payment status.')
        timer = setTimeout(poll, 6000)
      }
    }

    void poll()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [orderId])

  useEffect(() => {
    if (!orderId || paymentStatus !== 'paid') return
    let active = true

    async function linkPaidOrder() {
      try {
        const { data } = await getBrowserSupabase().auth.getSession()
        const token = data.session?.access_token
        if (!token) return
        const response = await fetch('/api/access', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'x-session-id': loadClientSessionId() ?? '',
          },
          body: JSON.stringify({ orderId }),
        })
        const result = await response.json() as { status?: AccessStatus; expiresAt?: string; error?: string }
        if (!response.ok) throw new Error(result.error ?? 'Could not link the confirmed payment.')
        if (!active) return
        window.localStorage.removeItem('skud-payment-order')
        setAccessStatus(result.status ?? null)
        setExpiresAt(result.expiresAt ?? null)
        if (result.status === 'superseded') {
          setMessage('This account is active on another device. Sign in again to continue.')
        }
        if (result.status === 'pending') {
          setMessage('Payment linked. A mentor must approve your subscription before you can enter the app.')
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Could not link the confirmed payment.')
      }
    }

    void linkPaidOrder()
    return () => { active = false }
  }, [orderId, paymentStatus])

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')

    try {
      const supabase = getBrowserSupabase()
      const result = mode === 'signup'
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.href },
          })
        : await supabase.auth.signInWithPassword({ email, password })
      if (result.error) throw result.error

      const session = result.data.session
      if (!session) {
        setMessage('Check your email to confirm your account, then sign in here to submit it for mentor approval.')
        setMode('login')
        return
      }

      // Mint the single active session for this device before checking access.
      try {
        const sessionResponse = await fetch('/api/session', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const sessionResult = await sessionResponse.json() as { sessionId?: string }
        if (sessionResponse.ok && sessionResult.sessionId) saveClientSessionId(sessionResult.sessionId)
      } catch {
        // Best-effort: enforcement starts on the next successful mint.
      }

      const response = await fetch('/api/access', orderId ? {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'x-session-id': loadClientSessionId() ?? '',
        },
        body: JSON.stringify({ orderId }),
      } : {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'x-session-id': loadClientSessionId() ?? '',
        },
        cache: 'no-store',
      })
      const access = await response.json() as {
        status: AccessStatus
        expiresAt?: string
        error?: string
      }
      if (access.status === 'superseded') throw new Error('This account is active on another device. Please sign in again.')
      if (!response.ok) throw new Error(access.error ?? 'Could not register your account.')
      window.localStorage.removeItem('skud-payment-order')
      setAccessStatus(access.status)
      if (access.status === 'approved') {
        setExpiresAt(access.expiresAt ?? null)
        window.setTimeout(() => window.location.assign('/dashboard'), 1200)
      }
      if (access.status === 'pending') {
        setMessage('Your payment is confirmed. A mentor must approve your account before you can enter SkuD Turbo.')
      }
      // Single active session per account: end every other signed-in device.
      try {
        await supabase.auth.signOut({ scope: 'others' })
      } catch {
        // Best-effort: another device's token then expires on its own.
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not complete account access.')
    } finally {
      setBusy(false)
    }
  }

  async function refreshApproval() {
    setBusy(true)
    setMessage(null)
    try {
      const { data } = await getBrowserSupabase().auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setAccessStatus(null)
        setMessage('Please sign in again to check your approval.')
        return
      }
      const response = await fetch('/api/access', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-session-id': loadClientSessionId() ?? '',
        },
        cache: 'no-store',
      })
      const access = await response.json() as { status?: AccessStatus; expiresAt?: string; error?: string }
      if (!response.ok) throw new Error(access.error ?? 'Could not check approval status.')
      setAccessStatus(access.status ?? null)
      setExpiresAt(access.expiresAt ?? null)
      if (access.status === 'superseded') {
        setMessage('This account is active on another device. Sign in again to continue.')
      }
      if (access.status === 'approved') {
        window.setTimeout(() => window.location.assign('/dashboard'), 1200)
      }
      if (access.status === 'payment_required') setMessage('No paid setup is linked to this account yet.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not check approval status.')
    } finally {
      setBusy(false)
    }
  }

  if (paymentStatus !== 'paid') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[#0b0b0d] px-5 text-center text-white">
        <Image src="/logo-synth.webp" alt="SkuD Turbo" width={72} height={72} priority className="size-16 rounded-2xl object-cover" />
        <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.25em] text-white/75">SkuD Turbo</p>
        <h1 className="mt-6 text-2xl font-bold">
          {paymentStatus === 'failed' ? 'Payment not completed' : 'Confirming your payment'}
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/55">
          {paymentStatus === 'failed'
            ? 'This payment did not complete. Return to the access page and try again.'
            : 'As soon as Synthyard confirms your payment, your account is registered for mentor approval.'}
        </p>
        {message && <p role="status" className="mt-4 max-w-sm text-xs text-white/45">{message}</p>}
        {paymentStatus === 'pending' && (
          <button type="button" onClick={() => void checkPayment()} className="mt-6 rounded-md border border-white/25 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">
            Check payment
          </button>
        )}
        {paymentStatus === 'failed' && (
          <a href="/dashboard" className="mt-6 rounded-md border border-white/25 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">
            Return to checkout
          </a>
        )}
      </main>
    )
  }

  if (accessStatus === 'pending' || accessStatus === 'rejected') {
    return (
      <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#0b0b0d] px-5 text-center text-white">
        <div
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_15%,rgba(255,68,79,0.12),transparent_48%)]"
          aria-hidden="true"
        />
        <DerivMark className="size-12 rounded-xl text-2xl" />
        <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.25em] text-primary">SkuD Turbo</p>
        <h1 className="mt-4 text-2xl font-extrabold">
          {accessStatus === 'pending' ? 'Awaiting mentor approval' : 'Access not approved'}
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/55">
          {accessStatus === 'pending'
            ? 'Your account is registered. A mentor must approve your subscription before the dashboard becomes available.'
            : 'Please contact your mentor for more information about this account.'}
        </p>
        <div className="mt-6 flex gap-3">
          {accessStatus === 'pending' && (
            <button type="button" disabled={busy} onClick={() => void refreshApproval()} className="rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {busy ? 'Checking...' : 'Check approval'}
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              clearClientSessionId()
              await getBrowserSupabase().auth.signOut()
              window.location.assign('/dashboard?login=1')
            }}
            className="rounded-md border border-white/15 px-4 py-2.5 text-sm font-bold text-white/75 transition-colors hover:text-white"
          >
            Sign out
          </button>
        </div>
        {message && <p role="status" className="mt-4 max-w-sm text-xs text-white/45">{message}</p>}
      </main>
    )
  }

  if (accessStatus === 'approved') {
    return (
      <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-[#0b0b0d] px-5 text-center text-white">
        <div
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_15%,rgba(255,68,79,0.12),transparent_48%)]"
          aria-hidden="true"
        />
        <div className="flex flex-col items-center">
          <DerivMark className="size-12 rounded-xl text-2xl" />
          <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.25em] text-primary">SkuD Turbo</p>
          <h1 className="mt-4 text-2xl font-extrabold">Subscription approved</h1>
          <p className="mt-3 text-sm text-white/55">
            Access is active until {expiresAt ? new Date(expiresAt).toLocaleDateString() : 'your renewal date'}.
          </p>
          <a href="/dashboard" className="mt-6 inline-flex rounded-md bg-primary px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-primary/85">
            Open SkuD Turbo
          </a>
        </div>
      </main>
    )
  }

  if (accessStatus === 'payment_required') {
    return (
      <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#0b0b0d] px-5 text-center text-white">
        <div
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_15%,rgba(255,68,79,0.12),transparent_48%)]"
          aria-hidden="true"
        />
        <DerivMark className="size-12 rounded-xl text-2xl" />
        <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.25em] text-primary">SkuD Turbo</p>
        <h1 className="mt-4 text-2xl font-extrabold">Complete your setup</h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/55">
          Your account is ready. Pay the one-time $13 USD server setup fee to Synthyard, then a mentor
          can approve your access.
        </p>
        <button
          type="button"
          onClick={() => setCheckoutOpen(true)}
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-extrabold text-white transition-colors hover:bg-primary/85"
        >
          Review Synthyard payment
        </button>
        <button
          type="button"
          onClick={async () => {
            clearClientSessionId()
            await getBrowserSupabase().auth.signOut()
            window.location.assign('/dashboard')
          }}
          className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-white/45 transition-colors hover:text-white"
        >
          Sign out
        </button>
        <SynthyardCheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} />
      </main>
    )
  }

  if (accessStatus === 'expired') {
    return (
      <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#0b0b0d] px-5 text-center text-white">
        <div
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_15%,rgba(255,68,79,0.12),transparent_48%)]"
          aria-hidden="true"
        />
        <DerivMark className="size-12 rounded-xl text-2xl" />
        <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.25em] text-primary">SkuD Turbo</p>
        <h1 className="mt-4 text-2xl font-bold">Subscription expired</h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
          Renew your hosting setup, then ask a mentor to approve the next subscription period.
        </p>
        <a href="/dashboard" className="mt-6 rounded-md bg-primary px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-primary/85">
          Renew access
        </a>
      </main>
    )
  }

  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#0b0b0d] px-5 py-10 text-white">
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_15%,rgba(255,68,79,0.12),transparent_48%)]"
        aria-hidden="true"
      />
      <section className="w-full max-w-md">
        <div className="flex flex-col items-center">
          <DerivMark className="size-12 rounded-xl text-2xl" />
          <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.24em] text-primary">SkuD Turbo</p>
        </div>
        <h1 className="mt-8 text-center text-3xl font-extrabold">{mode === 'signup' ? 'Create your account' : 'Sign in'}</h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-white/55">
          {mode === 'signup'
            ? orderId
              ? 'Payment is confirmed. Create the account your mentor will approve.'
              : 'Create your account, then complete the hosting payment to get access.'
            : 'Sign in to your mentor-approved SkuD Turbo account.'}
        </p>
        <form onSubmit={handleAuth} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-semibold text-white/75">
            Email
            <input name="email" type="email" autoComplete="email" required className="h-11 rounded-md border border-white/15 bg-[#1a1a1e] px-3 text-white outline-none placeholder:text-white/35 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-white/75">
            Password
            <div className="relative">
              <input name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={6} required className="h-11 w-full rounded-md border border-white/15 bg-[#1a1a1e] px-3 pr-12 text-white outline-none placeholder:text-white/35 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50" />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-white/50 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring"
              >
                {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
              </button>
            </div>
          </label>
          <button type="submit" disabled={busy} className="mt-1 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-extrabold text-white transition-colors hover:bg-primary/85 disabled:cursor-wait disabled:opacity-60">
            {busy ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <button type="button" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setMessage(null) }} className="mt-4 w-full text-sm font-semibold text-white/55 transition-colors hover:text-white">
          {mode === 'signup' ? 'Already registered? Sign in' : 'Need an account? Create one'}
        </button>
        {message && <p role="status" className="mt-4 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs leading-relaxed text-white/65">{message}</p>}
      </section>
    </main>
  )
}
