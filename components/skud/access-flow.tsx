'use client'

import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase'
import { DerivMark } from './deriv-logo'
import { clearClientSessionId, loadClientSessionId, saveClientSessionId } from './client-session'

type AccessStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'superseded'

export function AccessFlow({
  initialAccessStatus,
  loginOnly = false,
}: {
  initialAccessStatus?: AccessStatus
  loginOnly?: boolean
}) {
  const [mode, setMode] = useState<'signup' | 'login'>(loginOnly ? 'login' : 'signup')
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(initialAccessStatus ?? null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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

      const response = await fetch('/api/access', {
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
      setAccessStatus(access.status)
      if (access.status === 'approved') {
        setExpiresAt(access.expiresAt ?? null)
        window.setTimeout(() => window.location.assign('/dashboard'), 1200)
      }
      if (access.status === 'pending') {
        setMessage('Your account is registered. A mentor must approve it before you can enter SkuD Turbo.')
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not check approval status.')
    } finally {
      setBusy(false)
    }
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
            ? 'Your account is registered. A mentor must approve it before the dashboard becomes available.'
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
          Your access period has ended. Ask your mentor to renew your subscription, then check again.
        </p>
        <div className="mt-6 flex gap-3">
          <button type="button" disabled={busy} onClick={() => void refreshApproval()} className="rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {busy ? 'Checking...' : 'Check again'}
          </button>
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
            ? 'Create your account, then a mentor approves your access — no payment needed from you.'
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
