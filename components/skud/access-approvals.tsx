'use client'

import { useState } from 'react'

type PendingUser = { id: string; email: string; createdAt: string }

export function AccessApprovals() {
  const [setupCode, setSetupCode] = useState('')
  const [mentorName, setMentorName] = useState('')
  const [users, setUsers] = useState<PendingUser[]>([])
  const [durationMonths, setDurationMonths] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function loadPending() {
    setLoading(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/access', {
        headers: { 'x-mentor-setup-code': setupCode },
        cache: 'no-store',
      })
      const result = await response.json() as { users?: PendingUser[]; error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Could not load pending approvals.')
      setUsers(result.users ?? [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load pending approvals.')
    } finally {
      setLoading(false)
    }
  }

  async function approve(userId: string) {
    setLoading(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mentor-setup-code': setupCode,
        },
        body: JSON.stringify({
          userId,
          mentorName,
          durationMonths: Number(durationMonths[userId] ?? '1'),
        }),
      })
      const result = await response.json() as { error?: string; expiresAt?: string }
      if (!response.ok) throw new Error(result.error ?? 'Could not approve this account.')
      setMessage(`Access approved until ${new Date(result.expiresAt ?? '').toLocaleDateString()}.`)
      await loadPending()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not approve this account.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-dvh bg-background px-5 py-10 text-foreground">
      <section className="mx-auto w-full max-w-3xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-primary">Mentor tools</p>
        <h1 className="mt-3 text-3xl font-extrabold">Subscription approvals</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Approve a paid account for a selected number of 30-day months. Renewals begin after any current active subscription ends.
        </p>

        <div className="mt-7 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Mentor name
            <input value={mentorName} onChange={(event) => setMentorName(event.target.value)} maxLength={80} required className="h-11 rounded-md border border-input bg-background px-3" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Approval access code
            <input value={setupCode} onChange={(event) => setSetupCode(event.target.value)} type="password" autoComplete="current-password" required className="h-11 rounded-md border border-input bg-background px-3" />
          </label>
          <button type="button" disabled={loading || !setupCode} onClick={() => void loadPending()} className="min-h-11 rounded-md bg-primary px-4 text-sm font-extrabold text-primary-foreground disabled:opacity-50 sm:col-span-2">
            {loading ? 'Loading...' : 'Load pending users'}
          </button>
        </div>

        {message && <p role="status" className="mt-4 rounded-md border border-border px-4 py-3 text-sm">{message}</p>}
        <div className="mt-6 flex flex-col gap-3">
          {users.map((user) => (
            <article key={user.id} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-all font-bold">{user.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Requested {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <label className="sr-only" htmlFor={`duration-${user.id}`}>Subscription duration</label>
                <select
                  id={`duration-${user.id}`}
                  value={durationMonths[user.id] ?? '1'}
                  onChange={(event) => setDurationMonths((current) => ({ ...current, [user.id]: event.target.value }))}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((months) => (
                    <option key={months} value={months}>{months} {months === 1 ? 'month' : 'months'}</option>
                  ))}
                </select>
                <button type="button" disabled={loading || !mentorName.trim()} onClick={() => void approve(user.id)} className="h-10 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
                  Approve
                </button>
              </div>
            </article>
          ))}
          {!loading && users.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No pending users loaded.
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
