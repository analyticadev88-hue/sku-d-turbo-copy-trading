'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DERIV_SERVERS } from '@/lib/mt5-servers'
import { getBrowserSupabase } from '@/lib/supabase'

const MENTOR_ID_PATTERN = /^[A-Za-z0-9_-]{3,64}$/

type Mentor = {
  mentor_id?: unknown
  mentor_name?: unknown
  login?: unknown
  server?: unknown
  is_active?: unknown
  active_followers?: unknown
}

type BridgeAccount = {
  login?: unknown
  server?: unknown
  is_active?: unknown
  mentor_id?: unknown
  volume_multiplier?: unknown
  role?: unknown
}

type CreatedMentor = {
  mentorId: string
  mentorName: string
  login: string
  server: string
  mentorToken: string
  terminal?: string
}

async function adminFetch(path: string, init?: RequestInit) {
  const { data: sessionData } = await getBrowserSupabase().auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Sign in to continue.')
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      'x-supabase-access-token': accessToken,
      ...init?.headers,
    },
    cache: 'no-store',
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error((result as { error?: string } | null)?.error ?? 'The request failed.')
  }
  return result
}

export function AdminMentors() {
  const [mentors, setMentors] = useState<Mentor[] | null>(null)
  const [accounts, setAccounts] = useState<BridgeAccount[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [mentorId, setMentorId] = useState('')
  const [mentorName, setMentorName] = useState('')
  const [login, setLogin] = useState('')
  const [server, setServer] = useState(DERIV_SERVERS[0])
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formBusy, setFormBusy] = useState(false)
  const [created, setCreated] = useState<CreatedMentor | null>(null)
  const [tokenCopied, setTokenCopied] = useState(false)

  const [assignAccount, setAssignAccount] = useState('')
  const [assignMentor, setAssignMentor] = useState('')
  const [multiplier, setMultiplier] = useState('1')
  const [assignError, setAssignError] = useState<string | null>(null)
  const [assignBusy, setAssignBusy] = useState(false)
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const [assignMessage, setAssignMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const [mentorResult, accountResult] = await Promise.all([
        adminFetch('/api/admin/mentors'),
        adminFetch('/api/admin/bridge?path=accounts'),
      ])
      setMentors(Array.isArray(mentorResult) ? mentorResult as Mentor[] : [])
      setAccounts(Array.isArray(accountResult) ? accountResult as BridgeAccount[] : [])
    } catch (error) {
      setMentors(null)
      setAccounts(null)
      setLoadError(error instanceof Error ? error.message : 'Could not load mentors.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const accountList = accounts ?? []
  const mentorList = mentors ?? []
  const assignedAccounts = accountList.filter((account) => String(account.mentor_id ?? '') !== '')

  async function registerMentor() {
    setFormError(null)
    setFormBusy(true)
    try {
      const trimmedId = mentorId.trim()
      if (!MENTOR_ID_PATTERN.test(trimmedId)) {
        throw new Error('Mentor ID must be 3-64 characters: letters, numbers, - or _.')
      }
      if (!mentorName.trim()) {
        throw new Error('Enter the mentor name.')
      }
      if (!/^\d{4,20}$/.test(login.trim())) {
        throw new Error('Enter a valid MT5 login (digits only).')
      }
      if (password && password.length < 6) {
        throw new Error('The MT5 password must be at least 6 characters.')
      }
      const result = await adminFetch('/api/admin/mentors', {
        method: 'POST',
        body: JSON.stringify({
          mentorId: trimmedId,
          mentorName: mentorName.trim(),
          login: login.trim(),
          server,
          ...(password ? { password } : {}),
        }),
      }) as CreatedMentor
      setCreated(result)
      setTokenCopied(false)
      setMentorId('')
      setMentorName('')
      setLogin('')
      setPassword('')
      await load()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not register mentor.')
    } finally {
      setFormBusy(false)
    }
  }

  async function assign(unassignLogin?: string) {
    setAssignError(null)
    setAssignMessage(null)
    const targetLogin = unassignLogin ?? assignAccount
    const targetMentor = unassignLogin ? '' : assignMentor
    if (!targetLogin) {
      setAssignError('Choose an account to assign.')
      return
    }
    if (!unassignLogin && !targetMentor) {
      setAssignError('Choose a mentor.')
      return
    }
    if (unassignLogin) setRowBusy(unassignLogin)
    else setAssignBusy(true)
    try {
      await adminFetch('/api/admin/bridge', {
        method: 'POST',
        body: JSON.stringify({
          action: 'assign',
          login: targetLogin,
          mentorId: targetMentor,
          volumeMultiplier: Number(multiplier) || 1,
        }),
      })
      setAssignMessage(unassignLogin ? `Unassigned ${targetLogin}.` : `Assigned ${targetLogin} to ${targetMentor}.`)
      await load()
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : 'Could not update the assignment.')
    } finally {
      setRowBusy(null)
      setAssignBusy(false)
    }
  }

  const inputClass = 'h-11 w-full rounded-md border border-white/15 bg-[#1a1a1e] px-3 text-sm text-white outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50'
  const labelClass = 'text-sm text-white/75'

  return (
    <section className="mx-auto max-w-xl">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">Mentor program</p>
      <h1 className="mt-2 text-xl font-extrabold tracking-normal">Mentors</h1>
      <p className="mt-1 text-sm text-white/55">
        Register mentors, host their MT5 terminals, and assign student accounts to copy them.
      </p>

      {loadError && (
        <div className="mt-6 rounded-xl border border-primary/40 bg-[#111114] p-4">
          <p className="text-sm text-primary">{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 px-4 text-xs font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:border-primary/50 hover:text-primary"
          >
            Retry
          </button>
        </div>
      )}

      {!loadError && (
        <div className="mt-6 flex flex-col gap-6">
          <article className="rounded-xl border border-white/15 bg-[#111114] p-4">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-white/70">Register mentor</h2>
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <label htmlFor="mentor-id" className={labelClass}>Mentor ID</label>
                <input
                  id="mentor-id"
                  value={mentorId}
                  onChange={(event) => setMentorId(event.target.value)}
                  placeholder="e.g. mentor-skud-01"
                  className={inputClass}
                />
                <p className="text-xs text-white/45">3-64 characters: letters, numbers, - or _.</p>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="mentor-name" className={labelClass}>Name</label>
                <input
                  id="mentor-name"
                  value={mentorName}
                  onChange={(event) => setMentorName(event.target.value)}
                  placeholder="e.g. SkuD Master"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label htmlFor="mentor-login" className={labelClass}>MT5 login</label>
                  <input
                    id="mentor-login"
                    inputMode="numeric"
                    value={login}
                    onChange={(event) => setLogin(event.target.value.replace(/\D/g, ''))}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="mentor-server" className={labelClass}>Server</label>
                  <select
                    id="mentor-server"
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
                <label htmlFor="mentor-password" className={labelClass}>MT5 password <span className="text-white/40">(optional)</span></label>
                <input
                  id="mentor-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={inputClass}
                />
                <p className="text-xs leading-relaxed text-white/45">
                  Provide the MT5 password to host this mentor&apos;s terminal on the bridge — the mentor trades on
                  that terminal and trades copy to students automatically. Leave empty if the mentor runs the EA
                  on their own machine.
                </p>
              </div>
              {formError && <p role="alert" className="text-xs leading-relaxed text-primary">{formError}</p>}
              <button
                type="button"
                onClick={() => void registerMentor()}
                disabled={formBusy}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-primary px-5 text-sm font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-wait disabled:opacity-60"
              >
                {formBusy ? 'Registering…' : 'Register mentor'}
              </button>
            </div>
          </article>

          <article>
            <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-white/70">Mentor list</h2>
            <p className="mt-1 text-xs text-white/45">
              {mentors === null ? 'Loading mentors…' : `${mentorList.length} mentor${mentorList.length === 1 ? '' : 's'}`}
            </p>
            <div className="mt-3 flex flex-col gap-3">
              {mentorList.length === 0 && mentors !== null && (
                <p className="rounded-xl border border-white/10 bg-[#111114] p-4 text-sm text-white/55">
                  No mentors registered yet.
                </p>
              )}
              {mentorList.map((mentor) => {
                const id = String(mentor.mentor_id ?? '')
                const followers = Number(mentor.active_followers ?? 0)
                return (
                  <article key={id} className="rounded-xl border border-white/15 bg-[#111114] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{String(mentor.mentor_name ?? id)}</p>
                        <p className="mt-0.5 font-mono text-xs text-white/55">{id}</p>
                        <p className="mt-1 font-mono text-xs text-white/55">
                          {String(mentor.login ?? '')}@{String(mentor.server ?? '')}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] ${mentor.is_active ? 'border-[#4bb543]/40 text-[#4bb543]' : 'border-white/20 text-white/45'}`}>
                          {mentor.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-[10px] text-white/45">
                          {followers} follower{followers === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </article>

          <article className="rounded-xl border border-white/15 bg-[#111114] p-4">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-white/70">Student assignment</h2>
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <label htmlFor="assign-account" className={labelClass}>Account</label>
                <select
                  id="assign-account"
                  value={assignAccount}
                  onChange={(event) => setAssignAccount(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Choose an account…</option>
                  {accountList.map((account) => {
                    const value = String(account.login ?? '')
                    return (
                      <option key={value} value={value}>
                        {value}@{String(account.server ?? '')} ({String(account.role ?? 'student')})
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="assign-mentor" className={labelClass}>Mentor</label>
                <select
                  id="assign-mentor"
                  value={assignMentor}
                  onChange={(event) => setAssignMentor(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Choose a mentor…</option>
                  {mentorList.map((mentor) => {
                    const id = String(mentor.mentor_id ?? '')
                    return (
                      <option key={id} value={id}>
                        {String(mentor.mentor_name ?? id)} ({id})
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="assign-multiplier" className={labelClass}>Volume multiplier</label>
                <input
                  id="assign-multiplier"
                  type="number"
                  step={0.01}
                  min={0.01}
                  max={100}
                  value={multiplier}
                  onChange={(event) => setMultiplier(event.target.value)}
                  className={inputClass}
                />
              </div>
              {assignError && <p role="alert" className="text-xs leading-relaxed text-primary">{assignError}</p>}
              {assignMessage && !assignError && <p role="status" className="text-xs text-white/55">{assignMessage}</p>}
              <button
                type="button"
                onClick={() => void assign()}
                disabled={assignBusy || rowBusy !== null}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-[#4bb543] px-5 text-sm font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#4bb543]/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-wait disabled:opacity-60"
              >
                {assignBusy ? 'Assigning…' : 'Assign to mentor'}
              </button>
            </div>
          </article>

          {assignedAccounts.length > 0 && (
            <article>
              <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-white/70">Assigned accounts</h2>
              <div className="mt-3 flex flex-col gap-2">
                {assignedAccounts.map((account) => {
                  const value = String(account.login ?? '')
                  const accountMentor = String(account.mentor_id ?? '')
                  const accountMultiplier = Number(account.volume_multiplier ?? 1)
                  return (
                    <div
                      key={value}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-[#111114] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-bold">{value}@{String(account.server ?? '')}</p>
                        <p className="mt-0.5 text-[11px] text-white/55">
                          mentor <span className="font-mono">{accountMentor}</span> · x{accountMultiplier}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void assign(value)}
                        disabled={rowBusy !== null || assignBusy}
                        className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-md border border-primary/50 px-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-primary transition-colors hover:bg-primary/10 disabled:cursor-wait disabled:opacity-60"
                      >
                        {rowBusy === value ? 'Unassigning…' : 'Unassign'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </article>
          )}
        </div>
      )}

      <Dialog open={created !== null} onOpenChange={(open) => { if (!open) setCreated(null) }}>
        <DialogContent
          showCloseButton={false}
          className="top-auto bottom-0 left-0 right-0 max-h-[88dvh] w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-t-2xl border-white/10 bg-[#111114] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:right-auto sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:p-6"
        >
          <DialogHeader className="items-center text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-[#4bb543]/15 text-[#4bb543]">
              <Check className="size-6" aria-hidden="true" />
            </span>
            <DialogTitle className="text-xl font-extrabold text-white">Mentor registered</DialogTitle>
            <DialogDescription className="text-white/55">
              {created?.mentorName} ({created?.mentorId})
            </DialogDescription>
          </DialogHeader>
          {created && (
            <div className="mt-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/45">One-time mentor token</p>
              <div className="mt-2 flex items-center gap-2 rounded-md border border-white/15 bg-[#1a1a1e] p-2">
                <code className="min-w-0 flex-1 break-all px-1 font-mono text-xs text-white">{created.mentorToken}</code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(created.mentorToken)
                    setTokenCopied(true)
                  }}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-white/15 px-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:border-primary/50 hover:text-primary"
                >
                  {tokenCopied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                  {tokenCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-primary">
                Save it now — it won&apos;t be shown again.
              </p>
              {created.terminal && (
                <p className="mt-3 text-xs leading-relaxed text-white/55">{created.terminal}</p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setCreated(null)}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-xs font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            Done
          </button>
        </DialogContent>
      </Dialog>
    </section>
  )
}
