'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Plug, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getBrowserSupabase } from '@/lib/supabase'
import type { AdminTab } from './admin-app'

const FALLBACK_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'EURGBP', 'XAUUSD', 'USDCHF', 'NZDUSD',
  'Volatility 10 Index', 'Volatility 25 Index', 'Volatility 50 Index', 'Volatility 75 Index', 'Volatility 100 Index',
  'Volatility 10 (1s) Index', 'Volatility 25 (1s) Index', 'Volatility 50 (1s) Index', 'Volatility 75 (1s) Index', 'Volatility 100 (1s) Index',
  'Boom 500 Index', 'Boom 1000 Index', 'Crash 500 Index', 'Crash 1000 Index',
  'Step Index 10', 'Step Index 25', 'Step Index 50', 'Step Index 75', 'Step Index 100']
const ADMIN_MT5_KEY = 'skud-admin-mt5'

type TradeSide = 'BUY' | 'SELL'
type AccountResult = { login: string; ok: boolean; status?: string; error?: string }

type PriceRow = {
  symbol?: unknown
  bid?: unknown
  ask?: unknown
  volume_min?: unknown
  volume_max?: unknown
  volume_step?: unknown
}

function clampVolume(raw: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(raw)) return min
  const clamped = Math.min(max, Math.max(min, raw))
  const snapped = min + Math.round((clamped - min) / step) * step
  const fixed = Math.max(2, Math.ceil(-Math.log10(step)))
  return Number((Math.min(max, Math.max(min, snapped))).toFixed(fixed))
}

export function AdminTrade({ switchTab }: { switchTab: (tab: AdminTab) => void }) {
  const [adminAccount, setAdminAccount] = useState<{ login: string; server: string } | null | undefined>(undefined)
  const [accounts, setAccounts] = useState<{ login: string; server?: string; is_active?: boolean }[] | null>(null)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [prices, setPrices] = useState<PriceRow[]>([])
  const [symbols, setSymbols] = useState<string[]>(FALLBACK_SYMBOLS)
  const [symbol, setSymbol] = useState(FALLBACK_SYMBOLS[0])
  const [side, setSide] = useState<TradeSide>('BUY')
  const [volume, setVolume] = useState('0.01')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<AccountResult[] | null>(null)
  const [flash, setFlash] = useState<{ bid: 'up' | 'down' | null; ask: 'up' | 'down' | null }>({ bid: null, ask: null })
  const previousQuote = useRef<{ bid: number; ask: number } | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ADMIN_MT5_KEY)
      const parsed = raw ? JSON.parse(raw) as { login?: unknown; server?: unknown } : null
      setAdminAccount(parsed?.login && parsed?.server
        ? { login: String(parsed.login), server: String(parsed.server) }
        : null)
    } catch {
      setAdminAccount(null)
    }
  }, [])

  const loadAccounts = useCallback(async () => {
    try {
      const { data: sessionData } = await getBrowserSupabase().auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Sign in to continue.')
      const response = await fetch('/api/admin/trade', {
        headers: { 'x-supabase-access-token': accessToken },
        cache: 'no-store',
      })
      const result = await response.json() as {
        accounts?: { login?: unknown; server?: unknown; is_active?: unknown }[]
        error?: string
      }
      if (!response.ok) throw new Error(result.error ?? 'Could not load bridge accounts.')
      const list = Array.isArray(result.accounts) ? result.accounts : []
      setAccounts(list.map((account) => ({
        login: String(account.login ?? ''),
        server: typeof account.server === 'string' ? account.server : undefined,
        is_active: Boolean(account.is_active),
      })))
      setAccountsError(null)
    } catch (loadError) {
      setAccounts(null)
      setAccountsError(loadError instanceof Error ? loadError.message : 'Could not load bridge accounts.')
    }
  }, [])

  const loadPrices = useCallback(async (login: string) => {
    try {
      const { data: sessionData } = await getBrowserSupabase().auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) return
      const response = await fetch(`/api/admin/trade?prices=${encodeURIComponent(login)}`, {
        headers: { 'x-supabase-access-token': accessToken },
        cache: 'no-store',
      })
      if (!response.ok) return
      const result = await response.json().catch(() => null)
      if (!Array.isArray(result)) return
      const rows = result as PriceRow[]
      setPrices(rows)
      const bridgeSymbols = [...new Set(rows
        .map((row) => String(row.symbol ?? '').toUpperCase())
        .filter((value) => value.length > 0))]
      if (bridgeSymbols.length > 0) {
        setSymbols((current) => {
          const next = bridgeSymbols
          setSymbol((currentSymbol) => next.includes(currentSymbol) ? currentSymbol : next[0])
          return next
        })
      }
    } catch {
      // Keep the last quote on transient failures.
    }
  }, [])

  useEffect(() => {
    if (adminAccount === undefined || !adminAccount) return
    void loadAccounts()
    void loadPrices(adminAccount.login)
    const interval = setInterval(() => { void loadPrices(adminAccount.login) }, 2_000)
    return () => clearInterval(interval)
  }, [adminAccount, loadAccounts, loadPrices])

  const selectedPrice = prices.find((row) => String(row.symbol ?? '').toUpperCase() === symbol)
  const bid = Number(selectedPrice?.bid ?? NaN)
  const ask = Number(selectedPrice?.ask ?? NaN)
  const volumeMin = Number(selectedPrice?.volume_min ?? 0.01)
  const volumeMax = Number(selectedPrice?.volume_max ?? 100)
  const volumeStep = Number(selectedPrice?.volume_step ?? 0.01)

  useEffect(() => {
    if (!Number.isFinite(bid) || !Number.isFinite(ask)) return
    const previous = previousQuote.current
    setFlash({
      bid: previous && bid > previous.bid ? 'up' : previous && bid < previous.bid ? 'down' : null,
      ask: previous && ask > previous.ask ? 'up' : previous && ask < previous.ask ? 'down' : null,
    })
    previousQuote.current = { bid, ask }
  }, [bid, ask])

  useEffect(() => {
    setVolume((current) => {
      const parsed = Number(current)
      return clampVolume(Number.isFinite(parsed) ? parsed : volumeMin, volumeMin, volumeMax, volumeStep).toString()
    })
  }, [symbol, volumeMin, volumeMax, volumeStep])

  const activeCount = accounts?.filter((account) => account.is_active).length ?? 0
  const spread = Number.isFinite(bid) && Number.isFinite(ask) ? ask - bid : NaN

  async function placeTrade() {
    setBusy(true)
    setError(null)
    try {
      const { data: sessionData } = await getBrowserSupabase().auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Sign in to continue.')
      const finalVolume = clampVolume(Number(volume), volumeMin, volumeMax, volumeStep)
      const response = await fetch('/api/admin/trade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-access-token': accessToken,
        },
        body: JSON.stringify({
          symbol,
          side,
          volume: finalVolume,
          ...(adminAccount ? { mirrorLogin: adminAccount.login } : {}),
        }),
      })
      const result = await response.json() as { results?: AccountResult[]; error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Could not send the trade.')
      setResults(Array.isArray(result.results) ? result.results : [])
    } catch (tradeError) {
      setError(tradeError instanceof Error ? tradeError.message : 'Could not send the trade.')
    } finally {
      setBusy(false)
    }
  }

  if (adminAccount === undefined) {
    return (
      <section className="mx-auto max-w-xl">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">Copy trading</p>
        <h1 className="mt-2 text-xl font-extrabold tracking-normal">Broadcast a trade</h1>
        <div className="mt-6 rounded-xl border border-white/15 bg-[#111114] p-4">
          <p className="text-sm text-white/55">Loading…</p>
        </div>
      </section>
    )
  }

  if (!adminAccount) {
    return (
      <section className="mx-auto max-w-xl">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">Copy trading</p>
        <h1 className="mt-2 text-xl font-extrabold tracking-normal">Broadcast a trade</h1>
        <div className="mt-6 flex flex-col items-center gap-4 rounded-xl border border-white/15 bg-[#111114] p-6 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Plug className="size-6" aria-hidden="true" />
          </span>
          <p className="text-sm text-white/70">Connect your MT5 account to trade</p>
          <button
            type="button"
            onClick={() => switchTab('mt5')}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-xs font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary/85"
          >
            Connect MT5
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-xl">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">Copy trading</p>
      <h1 className="mt-2 text-xl font-extrabold tracking-normal">Broadcast a trade</h1>
      <p className="mt-1 text-sm text-white/55">
        Market orders go to every connected client account — and to your account {adminAccount.login}@{adminAccount.server}.
      </p>

      {accountsError ? (
        <div className="mt-6 rounded-xl border border-white/15 bg-[#111114] p-4">
          <p className="text-sm text-white/70">{accountsError}</p>
          <button
            type="button"
            onClick={() => void loadAccounts()}
            className="mt-3 inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 px-4 text-xs font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:border-primary/50 hover:text-primary"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <div className="rounded-xl border border-white/15 bg-[#111114] p-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="admin-symbol" className="text-sm text-white/75">Symbol</label>
              <select
                id="admin-symbol"
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
                className="h-10 rounded-md border border-white/15 bg-[#1a1a1e] px-3 text-sm text-white outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {symbols.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/10 bg-[#1a1a1e] p-3 text-center">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-white/45">Bid</p>
                <p className={`mt-1 font-mono text-xl font-extrabold transition-colors ${flash.bid === 'up' ? 'text-[#4bb543]' : flash.bid === 'down' ? 'text-primary' : 'text-white'}`}>
                  {Number.isFinite(bid) ? bid.toFixed(5) : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#1a1a1e] p-3 text-center">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-white/45">Ask</p>
                <p className={`mt-1 font-mono text-xl font-extrabold transition-colors ${flash.ask === 'up' ? 'text-[#4bb543]' : flash.ask === 'down' ? 'text-primary' : 'text-white'}`}>
                  {Number.isFinite(ask) ? ask.toFixed(5) : '—'}
                </p>
              </div>
            </div>
            <p className="mt-2 text-center text-[11px] text-white/45">
              {Number.isFinite(spread) ? `Spread ${spread.toFixed(5)}` : 'Waiting for the first quote…'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSide('BUY')}
              aria-pressed={side === 'BUY'}
              className={`min-h-12 rounded-md text-sm font-extrabold uppercase tracking-[0.12em] transition-colors ${side === 'BUY' ? 'bg-[#4bb543] text-white' : 'border border-white/15 text-white/55 hover:text-white'}`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setSide('SELL')}
              aria-pressed={side === 'SELL'}
              className={`min-h-12 rounded-md text-sm font-extrabold uppercase tracking-[0.12em] transition-colors ${side === 'SELL' ? 'bg-primary text-white' : 'border border-white/15 text-white/55 hover:text-white'}`}
            >
              Sell
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="admin-volume" className="text-sm text-white/75">Volume (lots)</label>
            <input
              id="admin-volume"
              type="number"
              step={volumeStep}
              min={volumeMin}
              max={volumeMax}
              value={volume}
              onChange={(event) => setVolume(event.target.value)}
              onBlur={() => setVolume(clampVolume(Number(volume), volumeMin, volumeMax, volumeStep).toString())}
              className="h-11 w-full rounded-md border border-white/15 bg-[#1a1a1e] px-3 text-sm text-white outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <p className="text-xs text-white/45">Lots (min {volumeMin}, step {volumeStep})</p>
          </div>

          <p className="text-xs text-white/45">
            Will send to {activeCount} connected client account{activeCount === 1 ? '' : 's'} plus your account
          </p>

          <button
            type="button"
            onClick={() => void placeTrade()}
            disabled={busy}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-primary px-5 text-sm font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? 'Sending trade...' : 'Place trade'}
          </button>
          {error && <p role="alert" className="text-xs leading-relaxed text-primary">{error}</p>}
        </div>
      )}

      <Dialog open={results !== null} onOpenChange={(open) => { if (!open) setResults(null) }}>
        <DialogContent
          showCloseButton={false}
          className="top-auto bottom-0 left-0 right-0 max-h-[88dvh] w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-t-2xl border-white/10 bg-[#111114] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:right-auto sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:p-6"
        >
          <DialogHeader className="items-center text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-[#4bb543]/15 text-[#4bb543]">
              <Check className="size-6" aria-hidden="true" />
            </span>
            <DialogTitle className="text-xl font-extrabold text-white">Trade sent</DialogTitle>
            <DialogDescription className="text-white/55">
              {side} {volume} {symbol}
            </DialogDescription>
          </DialogHeader>
          {results && (
            <ul className="mt-2 divide-y divide-white/10 border-y border-white/10">
              {results.map((result) => (
                <li key={result.login} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                  <span className="font-mono font-semibold">
                    {result.login}
                    {adminAccount && result.login === adminAccount.login && (
                      <span className="ml-1.5 text-white/45">(you)</span>
                    )}
                  </span>
                  {result.ok ? (
                    <span className="inline-flex items-center gap-1.5 font-bold text-[#4bb543]">
                      <Check className="size-3.5" aria-hidden="true" />
                      {result.status ?? 'Queued'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-right font-bold text-primary">
                      <X className="size-3.5 shrink-0" aria-hidden="true" />
                      {result.error ?? 'Failed'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs leading-relaxed text-white/45">
            The Student EA in each terminal confirms the fill within seconds.
          </p>
          <button
            type="button"
            onClick={() => setResults(null)}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-xs font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            Close
          </button>
        </DialogContent>
      </Dialog>
    </section>
  )
}
