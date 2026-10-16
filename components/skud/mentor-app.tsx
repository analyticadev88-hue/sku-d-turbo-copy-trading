'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { getBrowserSupabase } from '@/lib/supabase'
import { DerivMark } from './deriv-logo'

type MentorFollower = {
  login?: unknown
  server?: unknown
  is_active?: unknown
  volume_multiplier?: unknown
  role?: unknown
  connected?: unknown
  last_seen?: unknown
  balance?: unknown
  currency?: unknown
}

type MentorEvent = {
  event_id?: unknown
  position_id?: unknown
  event_type?: unknown
  login?: unknown
  symbol?: unknown
  side?: unknown
  volume?: unknown
  created_at?: unknown
}

type MentorOverview = {
  mentor_id?: unknown
  mentor_name?: unknown
  login?: unknown
  server?: unknown
  is_active?: unknown
  followers?: unknown
  events?: unknown
  error?: string
}

function relativeTime(timestamp: unknown): string {
  const value = typeof timestamp === 'number' ? timestamp * 1000 : Date.parse(String(timestamp ?? ''))
  if (!Number.isFinite(value)) return 'never'
  const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function eventTime(timestamp: unknown): string {
  const value = typeof timestamp === 'number' ? timestamp * 1000 : Date.parse(String(timestamp ?? ''))
  if (!Number.isFinite(value)) return ''
  return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function MentorApp({ mentorId }: { mentorId: string }) {
  const [overview, setOverview] = useState<MentorOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const { data: sessionData } = await getBrowserSupabase().auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Sign in to continue.')
      const response = await fetch('/api/mentor/overview', {
        headers: { 'x-supabase-access-token': accessToken },
        cache: 'no-store',
      })
      const result = await response.json() as MentorOverview
      if (!response.ok) throw new Error(result.error ?? 'Could not load mentor overview.')
      setOverview(result)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load mentor overview.')
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = setInterval(() => { void load() }, 5_000)
    return () => clearInterval(interval)
  }, [load])

  const followers = Array.isArray(overview?.followers) ? overview.followers as MentorFollower[] : []
  const events = (Array.isArray(overview?.events) ? overview.events as MentorEvent[] : [])
    .slice()
    .sort((a, b) => Number(b.created_at ?? 0) - Number(a.created_at ?? 0))
    .slice(0, 25)
  const mentorActive = Boolean(overview?.is_active)
  const mentorLogin = String(overview?.login ?? '')
  const mentorServer = String(overview?.server ?? '')
  const displayName = String(overview?.mentor_name ?? '') || mentorId

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[#0b0b0d] text-white">
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_15%,rgba(255,68,79,0.12),transparent_48%)]"
        aria-hidden="true"
      />

      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
        <Link href="/" aria-label="SkuD Turbo home" className="inline-flex items-center gap-3">
          <DerivMark className="size-10 rounded-xl text-xl" />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-extrabold leading-none">SkuD Turbo</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
              Mentor
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={async () => {
            await getBrowserSupabase().auth.signOut()
            window.location.assign('/dashboard?login=1')
          }}
          className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 transition-colors hover:text-white"
        >
          Sign out
        </button>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-5 pb-16 pt-2 sm:px-8">
        {error && !overview ? (
          <div className="rounded-xl border border-primary/40 bg-[#111114] p-4">
            <p className="text-sm text-primary">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 px-4 text-xs font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:border-primary/50 hover:text-primary"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <section className="rounded-xl border border-white/15 bg-[#111114] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/45">Mentor profile</p>
                  <h1 className="mt-1.5 truncate text-lg font-extrabold">{displayName}</h1>
                  <p className="mt-1 text-xs text-white/55">
                    ID <span className="font-mono">{String(overview?.mentor_id ?? mentorId)}</span>
                  </p>
                  {mentorLogin && (
                    <p className="mt-1 font-mono text-xs text-white/55">{mentorLogin}@{mentorServer}</p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] ${mentorActive ? 'border-[#4bb543]/40 text-[#4bb543]' : 'border-white/20 text-white/45'}`}>
                  {mentorActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              {error && <p role="alert" className="mt-3 text-xs text-primary">{error}</p>}
            </section>

            <p className="rounded-xl border border-white/10 bg-[#111114]/60 px-4 py-3 text-xs leading-relaxed text-white/45">
              Trades you place on your hosted MT5 terminal are copied to your students automatically.
              Keep that terminal running with the Mentor EA attached.
            </p>

            <section>
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-white/70">My Students</h2>
                <span className="text-xs text-white/45">{followers.length}</span>
              </div>
              <div className="mt-3 flex flex-col gap-3">
                {followers.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-[#111114] p-4 text-sm text-white/55">
                    No students linked yet — ask your admin to assign accounts.
                  </p>
                ) : (
                  followers.map((follower) => {
                    const connected = Boolean(follower.connected)
                    const active = Boolean(follower.is_active)
                    const login = String(follower.login ?? '')
                    const server = String(follower.server ?? '')
                    const balance = Number(follower.balance ?? 0)
                    const currency = String(follower.currency ?? '')
                    const multiplier = Number(follower.volume_multiplier ?? 1)
                    return (
                      <article key={login} className="rounded-xl border border-white/15 bg-[#111114] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-mono text-sm font-bold">{login}@{server}</p>
                            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-white/55">
                              <span
                                aria-hidden="true"
                                className={`inline-block size-2 rounded-full ${connected ? 'bg-[#4bb543]' : 'bg-white/25'}`}
                              />
                              {connected ? 'Terminal connected' : 'Terminal offline'}
                              <span className="text-white/30">·</span>
                              last seen {relativeTime(follower.last_seen)}
                            </p>
                            <p className="mt-1 text-xs text-white/55">
                              {Number.isFinite(balance) ? balance.toFixed(2) : '0.00'} {currency || 'USD'}
                              {String(follower.role ?? '') ? ` · ${String(follower.role)}` : ''}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <span className="rounded-full border border-white/20 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-white/65">
                              x{multiplier}
                            </span>
                            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] ${active ? 'border-[#4bb543]/40 text-[#4bb543]' : 'border-white/20 text-white/45'}`}>
                              {active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </article>
                    )
                  })
                )}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-white/70">Copy Activity</h2>
              <div className="mt-3 flex flex-col gap-2">
                {events.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-[#111114] p-4 text-sm text-white/55">
                    No trades copied yet.
                  </p>
                ) : (
                  events.map((event, index) => {
                    const eventType = String(event.event_type ?? '').toUpperCase()
                    const isOpen = eventType === 'OPEN'
                    const side = String(event.side ?? '').toUpperCase()
                    const volume = Number(event.volume ?? 0)
                    return (
                      <article
                        key={String(event.event_id ?? `${event.position_id ?? index}-${index}`)}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-[#111114] px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold">
                            <span className="font-mono">{String(event.symbol ?? '')}</span>
                            <span className="ml-2 text-xs font-semibold text-white/55">
                              {side} {Number.isFinite(volume) ? volume : ''}
                            </span>
                          </p>
                          <p className="mt-0.5 text-[11px] text-white/45">
                            student {String(event.login ?? '')} · {eventTime(event.created_at)}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] ${isOpen ? 'border-[#4bb543]/40 text-[#4bb543]' : 'border-primary/40 text-primary'}`}>
                          {eventType || 'TRADE'}
                        </span>
                      </article>
                    )
                  })
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
