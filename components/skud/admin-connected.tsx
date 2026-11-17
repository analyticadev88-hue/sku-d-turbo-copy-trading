'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase'

type ConnectedAccount = {
  login: string
  server: string
  clientEmail: string | null
  state: string
  is_active: boolean
  ea_connected: boolean
  balance: number | null
  balance_updated_at: number | null
  currency: string
  last_seen: number | null
  message: string
  provisioningError: string | null
}

type AccountListResponse = { accounts?: ConnectedAccount[]; error?: string }

const STATUS_LABELS: Record<string, string> = {
  connected: 'Connected',
  mode_unknown: 'Connected · mode unknown',
  mode_unsupported: 'Unsupported account mode',
  trading_disabled: 'Trading disabled',
  server_mismatch: 'Server mismatch',
  login_unverified: 'Login not verified',
  disconnected: 'Disconnected',
  starting: 'Starting MT5',
  inactive: 'Inactive',
  provisioning_error: 'Provisioning failed',
  not_registered: 'Bridge account missing',
}

function timestampLabel(timestamp: number | null) {
  if (!timestamp || !Number.isFinite(timestamp)) return 'Not reported'
  return new Date(timestamp * 1000).toLocaleString()
}

function statusTone(state: string) {
  if (state === 'connected') return 'border-[#4bb543]/40 text-[#4bb543]'
  if (state === 'starting' || state === 'mode_unknown') return 'border-amber-400/40 text-amber-300'
  if (state === 'inactive') return 'border-white/20 text-white/45'
  return 'border-primary/40 text-primary'
}

export function AdminConnected() {
  const [accounts, setAccounts] = useState<ConnectedAccount[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null)
  const inFlight = useRef(false)

  const load = useCallback(async (quiet = false) => {
    if (inFlight.current) return
    inFlight.current = true
    if (!quiet) setLoading(true)
    try {
      const { data: sessionData } = await getBrowserSupabase().auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Sign in to continue.')
      const response = await fetch('/api/admin/connected', {
        headers: { 'x-supabase-access-token': accessToken },
        cache: 'no-store',
      })
      const result = await response.json() as AccountListResponse
      if (!response.ok) throw new Error(result.error ?? 'Could not load connected accounts.')
      setAccounts(Array.isArray(result.accounts) ? result.accounts : [])
      setLastLoadedAt(Date.now())
      setLoadError(null)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load connected accounts.')
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void load(true)
    }, 30_000)
    return () => clearInterval(interval)
  }, [load])

  const activeCount = accounts?.filter((account) => account.is_active).length ?? 0
  const connectedCount = accounts?.filter((account) => account.ea_connected).length ?? 0
  const attentionCount = accounts?.filter((account) =>
    account.is_active && (!account.ea_connected || account.state === 'mode_unknown'),
  ).length ?? 0

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">
            Client terminals
          </p>
          <h1 className="mt-2 text-xl font-extrabold tracking-normal">Connected</h1>
          <p className="mt-1 text-sm text-white/55">
            Monitor client MT5 logins, latest confirmed balances, and connection problems.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh connected accounts"
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-white/15 px-3 text-xs font-extrabold text-white transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-wait disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {accounts && (
        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-white/15 bg-[#111114] p-3 text-center">
            <p className="text-xl font-extrabold text-white">{activeCount}</p>
            <p className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-white/45">Active</p>
          </div>
          <div className="rounded-xl border border-[#4bb543]/35 bg-[#111114] p-3 text-center">
            <p className="text-xl font-extrabold text-[#4bb543]">{connectedCount}</p>
            <p className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-white/45">Terminal online</p>
          </div>
          <div className="rounded-xl border border-primary/35 bg-[#111114] p-3 text-center">
            <p className="text-xl font-extrabold text-primary">{attentionCount}</p>
            <p className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-white/45">Needs attention</p>
          </div>
        </div>
      )}

      {lastLoadedAt && (
        <p className="mt-3 text-right text-[10px] text-white/40">
          Refreshed {new Date(lastLoadedAt).toLocaleTimeString()} · automatic refresh every 30 seconds
        </p>
      )}

      {loadError && (
        <div className="mt-4 rounded-xl border border-primary/40 bg-[#111114] p-4">
          <p role="alert" className="text-sm text-primary">{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 inline-flex min-h-9 items-center rounded-md border border-white/15 px-3 text-xs font-extrabold text-white hover:border-primary/50 hover:text-primary"
          >
            Try again
          </button>
        </div>
      )}

      {!accounts && !loadError && <p className="mt-6 text-sm text-white/50">Loading client accounts…</p>}
      {accounts?.length === 0 && (
        <div className="mt-5 rounded-xl border border-white/15 bg-[#111114] p-5 text-sm text-white/55">
          No student MT5 accounts have been registered on the bridge.
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {accounts?.map((account) => {
          const label = STATUS_LABELS[account.state] ?? 'Status unavailable'
          const balance = typeof account.balance === 'number' && Number.isFinite(account.balance)
            ? `${account.balance.toFixed(2)} ${account.currency}`.trim()
            : 'Not reported yet'
          return (
            <article key={account.login} className="rounded-xl border border-white/15 bg-[#111114] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">
                    {account.clientEmail ?? 'Client not linked'}
                  </p>
                  <p className="mt-1 font-mono text-xs text-white/60">
                    {account.login} · {account.server}
                  </p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] ${statusTone(account.state)}`}>
                  {label}
                </span>
              </div>
              {!account.clientEmail && (
                <p className="mt-2 text-[11px] text-amber-300/80">
                  Existing bridge account; client ownership was not recorded when it was first connected.
                </p>
              )}
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <p className="text-white/75">
                  <span className="text-white/40">Balance: </span>{balance}
                </p>
                <p className="text-white/50">
                  Balance updated: {timestampLabel(account.balance_updated_at)}
                </p>
                <p className="text-white/50">
                  Last heartbeat: {timestampLabel(account.last_seen)}
                </p>
                {account.message && (
                  <p className="text-white/65 sm:col-span-2">{account.message}</p>
                )}
                {account.provisioningError && account.state === 'starting' && (
                  <p className="text-primary sm:col-span-2">
                    Provisioning error: {account.provisioningError}
                  </p>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
