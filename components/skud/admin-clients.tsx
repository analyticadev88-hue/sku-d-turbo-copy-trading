'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase'

type AdminClient = {
  id: string
  email: string
  accessStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  isAdmin: boolean
  subscription: { status: string; expiresAt: string; mentorName: string } | null
}

type RowState = { busy: 'approve' | 'deactivate' | null; confirmDeactivate: boolean; message: string | null; error: boolean }

function badgeFor(client: AdminClient): { label: string; className: string } {
  if (client.isAdmin) return { label: 'Admin', className: 'border-primary/40 text-primary' }
  if (client.subscription) return { label: 'Approved', className: 'border-[#4bb543]/40 text-[#4bb543]' }
  if (client.accessStatus === 'PENDING') return { label: 'Pending', className: 'border-white/20 text-white/55' }
  if (client.accessStatus === 'REJECTED') return { label: 'Rejected', className: 'border-primary/40 text-primary' }
  return { label: 'Expired', className: 'border-white/20 text-white/55' }
}

export function AdminClients() {
  const [query, setQuery] = useState('')
  const [clients, setClients] = useState<AdminClient[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [months, setMonths] = useState<Record<string, number>>({})
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const load = useCallback(async (q: string) => {
    setListError(null)
    try {
      const { data: sessionData } = await getBrowserSupabase().auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Sign in to continue.')
      const response = await fetch(`/api/admin/clients?q=${encodeURIComponent(q)}`, {
        headers: { 'x-supabase-access-token': accessToken },
        cache: 'no-store',
      })
      const result = await response.json() as { clients?: AdminClient[]; error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Could not load clients.')
      setClients(Array.isArray(result.clients) ? result.clients : [])
    } catch (loadError) {
      setClients(null)
      setListError(loadError instanceof Error ? loadError.message : 'Could not load clients.')
    }
  }, [])

  useEffect(() => {
    void load('')
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [load])

  function handleQueryChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void load(value.trim()), 300)
  }

  function patchRow(id: string, patch: Partial<RowState>) {
    setRows((current) => {
      const existing: RowState = current[id] ?? { busy: null, confirmDeactivate: false, message: null, error: false }
      return { ...current, [id]: { ...existing, ...patch } }
    })
  }

  async function post(path: string, body: unknown, id: string, kind: RowState['busy']) {
    patchRow(id, { busy: kind, message: null })
    try {
      const { data: sessionData } = await getBrowserSupabase().auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Sign in to continue.')
      const response = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-access-token': accessToken,
        },
        body: JSON.stringify(body),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'The request failed.')
      patchRow(id, { busy: null, message: kind === 'approve' ? 'Subscription updated.' : 'Subscription deactivated.', error: false })
      await load(query.trim())
    } catch (error) {
      patchRow(id, { busy: null, message: error instanceof Error ? error.message : 'The request failed.', error: true })
    }
  }

  function approve(client: AdminClient) {
    void post('/api/admin/clients/approve', { userId: client.id, durationMonths: months[client.id] ?? 1 }, client.id, 'approve')
  }

  function deactivate(client: AdminClient) {
    const row = rows[client.id]
    if (!row?.confirmDeactivate) {
      patchRow(client.id, { confirmDeactivate: true })
      return
    }
    void post('/api/admin/clients/deactivate', { userId: client.id }, client.id, 'deactivate')
  }

  return (
    <section className="mx-auto max-w-xl">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">Client accounts</p>
      <h1 className="mt-2 text-xl font-extrabold tracking-normal">Clients</h1>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder="Search by email…"
          className="h-11 w-full rounded-md border border-white/15 bg-[#1a1a1e] pl-9 pr-3 text-sm text-white placeholder:text-white/35 outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <p className="mt-3 text-xs text-white/45">
        {clients === null ? 'Loading clients…' : `${clients.length} client${clients.length === 1 ? '' : 's'}`}
      </p>

      {listError && (
        <div className="mt-4 rounded-xl border border-primary/40 bg-[#111114] p-4">
          <p className="text-sm text-primary">{listError}</p>
          <button
            type="button"
            onClick={() => void load(query.trim())}
            className="mt-3 inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 px-4 text-xs font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:border-primary/50 hover:text-primary"
          >
            Retry
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {clients?.map((client) => {
          const badge = badgeFor(client)
          const row = rows[client.id]
          return (
            <article key={client.id} className="rounded-xl border border-white/15 bg-[#111114] p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-all text-sm font-bold">{client.email}</p>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] ${badge.className}`}>
                  {badge.label}
                </span>
              </div>
              <p className="mt-2 text-xs text-white/55">
                {client.subscription
                  ? `Subscription: expires ${new Date(client.subscription.expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : 'No active subscription'}
              </p>
              {!client.isAdmin && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Subscription months"
                    value={months[client.id] ?? 1}
                    onChange={(event) => setMonths((current) => ({ ...current, [client.id]: Number(event.target.value) }))}
                    className="h-9 rounded-md border border-white/15 bg-[#1a1a1e] px-2 text-xs text-white outline-none focus-visible:border-primary"
                  >
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                      <option key={value} value={value}>{value} mo</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => approve(client)}
                    disabled={row?.busy !== null && row?.busy !== undefined}
                    className="inline-flex min-h-9 items-center justify-center rounded-md bg-[#4bb543] px-3 text-xs font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#4bb543]/85 disabled:cursor-wait disabled:opacity-60"
                  >
                    {row?.busy === 'approve' ? 'Approving…' : client.subscription ? 'Extend' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deactivate(client)}
                    disabled={row?.busy !== null && row?.busy !== undefined}
                    className={`inline-flex min-h-9 items-center justify-center rounded-md border px-3 text-xs font-extrabold uppercase tracking-[0.08em] transition-colors disabled:cursor-wait disabled:opacity-60 ${row?.confirmDeactivate ? 'border-primary bg-primary/10 text-primary' : 'border-primary/50 text-primary hover:bg-primary/10'}`}
                  >
                    {row?.busy === 'deactivate' ? 'Deactivating…' : row?.confirmDeactivate ? 'Confirm?' : 'Deactivate'}
                  </button>
                </div>
              )}
              {row?.message && (
                <p role="status" className={`mt-2 text-xs ${row.error ? 'text-primary' : 'text-white/55'}`}>
                  {row.message}
                </p>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
