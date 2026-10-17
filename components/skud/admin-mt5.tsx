'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { DERIV_SERVERS } from '@/lib/mt5-servers'
import { getBrowserSupabase } from '@/lib/supabase'
import type { AdminTab } from './admin-app'

const STORAGE_KEY = 'skud-admin-mt5'

type StoredAdminAccount = { login: string; server: string }

type TerminalStatus = {
  terminal_connected?: unknown
  state?: unknown
  reported_server?: unknown
  expected_server?: unknown
  balance?: unknown
  currency?: unknown
  message?: unknown
  error?: string
}

function loadStored(): StoredAdminAccount | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const account = JSON.parse(raw) as Partial<StoredAdminAccount>
    if (!account.login || !account.server) return null
    return { login: String(account.login), server: String(account.server) }
  } catch {
    return null
  }
}

export function AdminMt5({ switchTab }: { switchTab: (tab: AdminTab) => void }) {
  const [connected, setConnected] = useState<StoredAdminAccount | null>(null)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [server, setServer] = useState(DERIV_SERVERS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<TerminalStatus | null>(null)

  useEffect(() => {
    setConnected(loadStored())
  }, [])

  const loadStatus = useCallback(async (targetLogin: string) => {
    try {
      const { data: sessionData } = await getBrowserSupabase().auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) return
      const response = await fetch(`/api/admin/mt5?login=${encodeURIComponent(targetLogin)}`, {
        headers: { 'x-supabase-access-token': accessToken },
        cache: 'no-store',
      })
      const result = await response.json().catch(() => null) as TerminalStatus | null
      if (response.ok && result) setStatus(result)
    } catch {
      // Keep the last known status on transient failures.
    }
  }, [])

  useEffect(() => {
    if (!connected) {
      setStatus(null)
      return
    }
    void loadStatus(connected.login)
    const interval = setInterval(() => { void loadStatus(connected.login) }, 5_000)
    return () => clearInterval(interval)
  }, [connected, loadStatus])

  async function connect() {
    setBusy(true)
    setError(null)
    try {
      if (!/^\d{4,20}$/.test(login.trim())) {
        throw new Error('Enter a valid MT5 login (digits only).')
      }
      if (!password) {
        throw new Error('Enter the MT5 trading password.')
      }
      const { data: sessionData } = await getBrowserSupabase().auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Sign in to continue.')
      const response = await fetch('/api/admin/mt5', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-access-token': accessToken,
        },
        body: JSON.stringify({ login: login.trim(), password, server }),
        cache: 'no-store',
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        throw new Error(result?.error ?? 'The MT5 bridge could not register this account.')
      }
      const stored = { login: login.trim(), server }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
      setConnected(stored)
      setPassword('')
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Could not connect the account.')
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    if (!connected) return
    const target = connected
    setBusy(true)
    setError(null)
    try {
      const { data: sessionData } = await getBrowserSupabase().auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Sign in to continue.')
      const response = await fetch(`/api/admin/mt5?login=${encodeURIComponent(target.login)}`, {
        method: 'DELETE',
        headers: { 'x-supabase-access-token': accessToken },
        cache: 'no-store',
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        throw new Error(result?.error ?? 'Could not disconnect this account.')
      }
      window.localStorage.removeItem(STORAGE_KEY)
      setConnected(null)
      setStatus(null)
      // Hard refresh so no stale account state survives the disconnect.
      window.location.reload()
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : 'Could not disconnect this account.')
    } finally {
      setBusy(false)
    }
  }

  const inputClass = 'h-11 w-full rounded-md border border-white/15 bg-[#1a1a1e] px-3 text-sm text-white outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50'
  const isTerminalConnected = Boolean(status?.terminal_connected)
  const balance = Number(status?.balance ?? 0)
  const currency = String(status?.currency ?? '')

  return (
    <section className="mx-auto max-w-xl">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">MT5 terminal</p>
      <h1 className="mt-2 text-xl font-extrabold tracking-normal">MT5</h1>
      <p className="mt-1 text-sm text-white/55">
        Connect your own MT5 account so trades you broadcast are mirrored to it.
      </p>

      {!connected ? (
        <div className="mt-6 flex flex-col gap-4 rounded-xl border border-white/15 bg-[#111114] p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="admin-mt5-login" className="text-sm text-white/75">MT5 login</label>
              <input
                id="admin-mt5-login"
                inputMode="numeric"
                value={login}
                onChange={(event) => setLogin(event.target.value.replace(/\D/g, ''))}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="admin-mt5-server" className="text-sm text-white/75">Server</label>
              <select
                id="admin-mt5-server"
                value={server}
                onChange={(event) => setServer(event.target.value)}
                className={inputClass}
              >
                {DERIV_SERVERS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="admin-mt5-password" className="text-sm text-white/75">Password</label>
            <div className="relative">
              <input
                id="admin-mt5-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={`${inputClass} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-white/55 transition-colors hover:text-white"
              >
                {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
          {error && <p role="alert" className="text-xs leading-relaxed text-primary">{error}</p>}
          <button
            type="button"
            onClick={() => void connect()}
            disabled={busy}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-primary px-5 text-sm font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? 'Connecting…' : 'Connect account'}
          </button>
          <p className="text-xs leading-relaxed text-white/45">
            Your password is sent to the managed bridge to start the MT5 terminal. The status appears as soon as
            the broker login is confirmed.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <article className="rounded-xl border border-white/15 bg-[#111114] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/45">Connected account</p>
                <p className="mt-1.5 font-mono text-lg font-extrabold">{connected.login}@{connected.server}</p>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-white/55">
                  <span
                    aria-hidden="true"
                    className={`inline-block size-2 rounded-full ${isTerminalConnected ? 'bg-[#4bb543]' : 'bg-white/25'}`}
                  />
                  {isTerminalConnected
                    ? `Terminal connected${currency ? ` · ${Number.isFinite(balance) ? balance.toFixed(2) : '0.00'} ${currency}` : ''}`
                    : (String(status?.message ?? '') || 'Waiting for the terminal to confirm the broker login…')}
                </p>
                {!isTerminalConnected && status && String(status.reported_server ?? '') && (
                  <p className="mt-1 text-[11px] text-white/45">
                    MT5 reports server {String(status.reported_server)}; expected {String(status.expected_server ?? connected.server)}.
                  </p>
                )}
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] ${isTerminalConnected ? 'border-[#4bb543]/40 text-[#4bb543]' : 'border-white/20 text-white/45'}`}>
                {isTerminalConnected ? 'Connected' : 'Pending'}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => switchTab('home')}
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-xs font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary/85"
              >
                Go to trading
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => { void disconnect() }}
                disabled={busy}
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-primary/50 px-4 text-xs font-extrabold uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/10 disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </article>
        </div>
      )}
    </section>
  )
}
