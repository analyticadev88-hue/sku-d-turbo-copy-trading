'use client'

import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getBrowserSupabase } from '@/lib/supabase'

const FALLBACK_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'EURGBP', 'XAUUSD', 'USDCHF', 'NZDUSD']

type TradeSide = 'BUY' | 'SELL'
type AccountResult = { login: string; ok: boolean; status?: string; error?: string }

export function AdminTrade() {
  const [accounts, setAccounts] = useState<{ login: string; server?: string; is_active?: boolean }[] | null>(null)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [symbols, setSymbols] = useState<string[]>(FALLBACK_SYMBOLS)
  const [symbol, setSymbol] = useState(FALLBACK_SYMBOLS[0])
  const [side, setSide] = useState<TradeSide>('BUY')
  const [volume, setVolume] = useState('0.01')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<AccountResult[] | null>(null)

  useEffect(() => {
    let active = true
    async function loadAccounts() {
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
        if (!active) return
        const list = Array.isArray(result.accounts) ? result.accounts : []
        setAccounts(list.map((account) => ({
          login: String(account.login ?? ''),
          server: typeof account.server === 'string' ? account.server : undefined,
          is_active: Boolean(account.is_active),
        })))
        setAccountsError(null)

        const bridgeSymbols = new Set<string>()
        for (const account of list) {
          const prices = (account as { prices?: { symbol?: unknown }[] }).prices
          if (Array.isArray(prices)) {
            for (const price of prices) {
              if (typeof price?.symbol === 'string' && price.symbol) bridgeSymbols.add(price.symbol.toUpperCase())
            }
          }
        }
        if (bridgeSymbols.size > 0) {
          const next = [...bridgeSymbols]
          setSymbols(next)
          setSymbol(next[0])
        }
      } catch (loadError) {
        if (active) {
          setAccounts(null)
          setAccountsError(loadError instanceof Error ? loadError.message : 'Could not load bridge accounts.')
        }
      }
    }
    void loadAccounts()
    return () => { active = false }
  }, [])

  const activeCount = accounts?.filter((account) => account.is_active).length ?? 0

  async function placeTrade() {
    setBusy(true)
    setError(null)
    try {
      const { data: sessionData } = await getBrowserSupabase().auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Sign in to continue.')
      const response = await fetch('/api/admin/trade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-access-token': accessToken,
        },
        body: JSON.stringify({ symbol, side, volume: Number(volume) }),
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

  return (
    <section className="mx-auto max-w-xl">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">Copy trading</p>
      <h1 className="mt-2 text-xl font-extrabold tracking-normal">Broadcast a trade</h1>
      <p className="mt-1 text-sm text-white/55">
        Market orders go to every connected client account on the bridge.
      </p>

      {accountsError ? (
        <div className="mt-6 rounded-xl border border-white/15 bg-[#111114] p-4">
          <p className="text-sm text-white/70">{accountsError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 px-4 text-xs font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:border-primary/50 hover:text-primary"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="admin-symbol" className="text-sm text-white/75">Symbol</label>
            <select
              id="admin-symbol"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              className="h-11 w-full rounded-md border border-white/15 bg-[#1a1a1e] px-3 text-sm text-white outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {symbols.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
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
              step={0.01}
              min={0.01}
              max={100}
              value={volume}
              onChange={(event) => setVolume(event.target.value)}
              className="h-11 w-full rounded-md border border-white/15 bg-[#1a1a1e] px-3 text-sm text-white outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          <p className="text-xs text-white/45">
            Will send to {activeCount} connected client account{activeCount === 1 ? '' : 's'}
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
                  <span className="font-mono font-semibold">{result.login}</span>
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
