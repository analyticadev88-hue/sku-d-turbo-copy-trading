'use client'

import { useEffect, useState } from 'react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import {
  ArrowRight,
  House,
  LogOut,
  UserRound,
} from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { clearStoredAccount, loadStoredAccount } from './mt5-session'
import { clearClientSessionId, loadClientSessionId } from './client-session'
import { DerivMark } from './deriv-logo'
import { Mt5ConnectDialog } from './mt5-connect'

const DEFAULT_MENTOR_ID = 'SkudTurbo'

function firstNameFromEmail(email: string | null) {
  if (!email) return ''
  const local = email.split('@')[0] ?? ''
  const raw = (local.split(/[._\-+]/)[0] ?? '').replace(/[^a-zA-Z]/g, '')
  if (!raw) return ''
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

type DashboardProps = { preview?: boolean }
type Tab = 'home' | 'profile'
type LiveMt5Account = { login: string; server: string; statusToken: string }
type Mt5Status = {
  terminal_connected?: boolean
  balance?: number
  currency?: string
  message?: string
}

export function Dashboard({ preview = false }: DashboardProps) {
  const [tab, setTab] = useState<Tab>('home')
  const [accountConnected, setAccountConnected] = useState(preview)
  const [mentorId, setMentorId] = useState(preview ? DEFAULT_MENTOR_ID : 'Pending setup')
  const [liveAccount, setLiveAccount] = useState<LiveMt5Account | null>(null)
  const [liveStatus, setLiveStatus] = useState<Mt5Status | null>(null)
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [accountSheetOpen, setAccountSheetOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    if (preview) return
    let active = true
    getBrowserSupabase().auth.getUser().then(({ data }) => {
      if (active) setUserEmail(data.user?.email ?? null)
    }).catch(() => {})
    return () => { active = false }
  }, [preview])

  const greeting = greetingForHour(new Date().getHours())
  const firstName = preview ? 'Skud' : firstNameFromEmail(userEmail)

  useEffect(() => {
    if (preview) return
    const account = loadStoredAccount()
    if (!account) return
    setLiveAccount(account)
    setLiveStatus({ message: 'Waiting for the MT5 terminal and EA login confirmation.' })
    setAccountConnected(true)
    setMentorId(DEFAULT_MENTOR_ID)
  }, [preview])

  useEffect(() => {
    if (!liveAccount) return
    const account = liveAccount

    let active = true
    let interval: ReturnType<typeof setInterval> | undefined

    async function refreshStatus() {
      try {
        const { data: sessionData } = await getBrowserSupabase().auth.getSession()
        const accessToken = sessionData.session?.access_token
        if (!accessToken) throw new Error('Your SkuD Turbo session has expired. Sign in again.')
        const response = await fetch(`/api/mt5/status?login=${encodeURIComponent(account.login)}`, {
          headers: {
            Authorization: `Bearer ${account.statusToken}`,
            'x-supabase-access-token': accessToken,
            'x-session-id': loadClientSessionId() ?? '',
          },
          cache: 'no-store',
        })
        const result = await response.json() as Mt5Status & { error?: string }
        if (!response.ok) {
          if (active) setLiveStatus({ message: result.error ?? 'Could not read MT5 status.' })
          if (response.status === 401 && interval) clearInterval(interval)
          return
        }
        if (active) setLiveStatus(result)
      } catch {
        if (active) setLiveStatus({ message: 'Could not reach the MT5 status service.' })
      }
    }

    void refreshStatus()
    interval = setInterval(() => void refreshStatus(), 5_000)
    return () => {
      active = false
      if (interval) clearInterval(interval)
    }
  }, [liveAccount])

  async function signOut() {
    setAccountSheetOpen(false)
    const account = liveAccount
    if (account) {
      try {
        const { data: sessionData } = await getBrowserSupabase().auth.getSession()
        const accessToken = sessionData.session?.access_token
        await fetch(`/api/mt5/accounts/${encodeURIComponent(account.login)}/disconnect`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${account.statusToken}`,
            ...(accessToken ? { 'x-supabase-access-token': accessToken } : {}),
            'x-session-id': loadClientSessionId() ?? '',
          },
        })
      } catch {
        // Even if the bridge is unreachable, still end the local session.
      }
    }
    clearStoredAccount()
    setAccountConnected(false)
    setLiveAccount(null)
    setLiveStatus(null)
    setTab('home')
  }

  async function signOutOfApp() {
    await signOut()
    clearClientSessionId()
    await getBrowserSupabase().auth.signOut()
    window.location.assign('/dashboard?login=1')
  }

  function openAccountDialog() {
    setAccountDialogOpen(true)
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col bg-background px-0 pb-24 pt-0 text-foreground sm:px-0">
      {tab === 'profile' && (
        <header className="mx-auto flex w-full max-w-xl items-center justify-between gap-5 px-4 py-5 sm:px-6 sm:py-6">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">Your account</p>
            <h1 className="mt-2 text-xl font-extrabold tracking-normal">Profile</h1>
          </div>
        </header>
      )}

      {tab === 'home' ? (
        <HomeView
          preview={preview}
          accountConnected={accountConnected}
          liveAccount={liveAccount}
          liveStatus={liveStatus}
          mentorId={mentorId}
          greeting={greeting}
          firstName={firstName}
          onConnect={openAccountDialog}
          onSignOut={signOut}
          onAccountDetails={() => setAccountSheetOpen(true)}
        />
      ) : (
        <ProfileView preview={preview} mentorId={mentorId} firstName={firstName} userEmail={userEmail} onSignOut={signOutOfApp} />
      )}

      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0b0b0d]/95 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur-md"
      >
        <div className="mx-auto flex w-full max-w-md items-center justify-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setTab('home')}
            aria-current={tab === 'home' ? 'page' : undefined}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-all ${tab === 'home' ? 'bg-[#e52f49] text-white shadow-[0_12px_24px_rgba(229,47,73,0.28)]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
          >
            <House className="size-[18px]" aria-hidden="true" />
            Home
          </button>
          <button
            type="button"
            onClick={() => setTab('profile')}
            aria-current={tab === 'profile' ? 'page' : undefined}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-all ${tab === 'profile' ? 'bg-[#e52f49] text-white shadow-[0_12px_24px_rgba(229,47,73,0.28)]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
          >
            <UserRound className="size-[18px]" aria-hidden="true" />
            Profile
          </button>
        </div>
      </nav>

      <Mt5ConnectDialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen} preview={preview} />

      <Dialog open={accountSheetOpen} onOpenChange={setAccountSheetOpen}>
        <DialogContent className="top-auto bottom-3 left-3 right-3 max-h-[82dvh] w-auto translate-x-0 translate-y-0 overflow-y-auto rounded-t-xl border-white/10 bg-[#111114] p-5 text-white sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:right-auto sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-md sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-white">Account details</DialogTitle>
            <DialogDescription className="text-white/55">
              {preview ? 'This is sample preview data, not a live Deriv connection.' : 'Account status is confirmed by the MT5 EA heartbeat.'}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-white/10 bg-[#1a1a1e] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-white/45">{preview ? 'Preview account' : 'MT5 account'}</p>
                <p className="mt-1 text-sm font-extrabold">Deriv MT5</p>
              </div>
              <span className="rounded-sm border border-primary/30 bg-primary/10 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-primary">{preview ? 'Sample' : liveStatus?.terminal_connected ? 'Connected' : 'Pending'}</span>
            </div>
            <p className="mt-5 font-mono text-3xl font-extrabold tabular-nums">{preview ? '$10,000.00' : liveStatus?.terminal_connected && typeof liveStatus.balance === 'number' ? liveStatus.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Waiting for MT5'} <span className="text-xs font-bold text-white/45">{preview ? 'USD' : liveStatus?.currency ?? ''}</span></p>
            <dl className="mt-4 divide-y divide-white/10 border-y border-white/10 text-xs">
              <div className="flex justify-between gap-4 py-3"><dt className="text-white/50">Login</dt><dd className="font-mono font-semibold">{preview ? '345643' : liveAccount?.login ?? 'Not connected'}</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-white/50">Server</dt><dd className="font-semibold">{preview ? 'Deriv-Demo' : liveAccount?.server ?? '—'}</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-white/50">Connection</dt><dd className="max-w-[65%] text-right font-semibold text-primary">{preview ? 'Preview only' : liveStatus?.terminal_connected ? 'EA confirmed' : liveStatus?.message ?? 'Waiting for EA confirmation'}</dd></div>
            </dl>
          </div>
          <button
            type="button"
            onClick={() => {
              setAccountSheetOpen(false)
              openAccountDialog()
            }}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-[#e52f49] px-4 text-xs font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#cc263e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Connect another account
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={signOut}
            className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-white/15 px-4 text-xs font-extrabold uppercase tracking-[0.1em] text-white/65 transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </button>
        </DialogContent>
      </Dialog>

    </div>
  )
}

function HomeView({
  preview,
  accountConnected,
  liveAccount,
  liveStatus,
  mentorId,
  greeting,
  firstName,
  onConnect,
  onSignOut,
  onAccountDetails,
}: {
  preview: boolean
  accountConnected: boolean
  liveAccount: LiveMt5Account | null
  liveStatus: Mt5Status | null
  mentorId: string
  greeting: string
  firstName: string
  onConnect: () => void
  onSignOut: () => void
  onAccountDetails: () => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col bg-[#0b0b0d]">
      <section className="relative isolate flex min-h-[min(72svh,620px)] flex-col overflow-hidden rounded-b-[28px] bg-[#09090b] px-4 pb-6 pt-0 text-white sm:min-h-[520px] sm:px-8 sm:pb-7 sm:rounded-b-[34px]">
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(135deg,#09090b_0%,#09090b_40%,#0d0d10_100%)]" aria-hidden="true" />
        <div
          className="absolute inset-y-0 right-0 -z-10 w-[60%] bg-[linear-gradient(135deg,#ef3549_0%,#c61e39_100%)] sm:w-[62%]"
          style={{ clipPath: 'polygon(22% 0, 100% 0, 100% 100%, 0 100%)' }}
          aria-hidden="true"
        />
        <div className="relative z-10 h-[calc(env(safe-area-inset-top)+2.75rem)] shrink-0" aria-hidden="true" />
        <div className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+2.5rem)] aspect-square w-[min(74vw,38svh,25rem)] -translate-x-1/2 sm:top-[2%] sm:w-[min(38vw,27rem)]" role="img" aria-label="Animated SkuD trading assistant">
          <DotLottieReact
            src="/Anima%20Bot.lottie"
            autoplay
            loop
            className="absolute inset-0 size-full"
          />
        </div>
        <div className="relative z-10 mt-auto max-w-[82%] pb-1 sm:max-w-[65%]">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#ffc4cd]">MT5 account</p>
          <h1 className="mt-2 text-balance text-3xl font-extrabold uppercase leading-[0.96] sm:text-5xl">
            {firstName ? `${greeting},` : `${greeting}.`}
            {firstName ? (<><br />{firstName}.</>) : null}
          </h1>
        </div>
      </section>

      <section aria-label="MT5 account" className="relative z-10 -mt-5 flex flex-1 flex-col gap-4 rounded-t-[28px] bg-[#0b0b0d] px-4 pb-5 pt-5 text-white sm:rounded-t-[34px] sm:px-8 sm:gap-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-white/45">{preview ? 'Preview account' : liveStatus?.terminal_connected ? 'MT5 connected' : accountConnected ? 'Waiting for MT5' : 'Account access'}</p>
            <p className="mt-1 text-sm font-bold text-white">{accountConnected ? 'Your Deriv MT5' : 'Sign in to Deriv MT5'}</p>
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-[#17171b] p-4 sm:p-5">
          {accountConnected && (
            <div className="mb-4 flex items-end justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="text-[8px] font-extrabold uppercase tracking-[0.15em] text-white/40">Account balance</p>
                <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums text-white">
                  {preview
                    ? '$10,000'
                    : liveStatus?.terminal_connected && typeof liveStatus.balance === 'number'
                      ? liveStatus.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : 'Pending'}
                  <span className="ml-1 text-[10px] font-bold text-white/45">{preview ? 'USD' : liveStatus?.currency ?? ''}</span>
                </p>
              </div>
              {preview && <span className="pb-1 text-[8px] font-bold uppercase tracking-[0.1em] text-white/35">Sample</span>}
            </div>
          )}
          <div className="flex min-h-[58px] items-center justify-between gap-3">
            <button type="button" onClick={accountConnected ? onAccountDetails : onConnect} className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <DerivMark className="size-8 shrink-0 rounded-none bg-transparent text-2xl text-primary" />
              <span className="min-w-0"><span className="block text-[8px] font-extrabold uppercase tracking-[0.14em] text-white/45">Login ID</span><span className="mt-1 block truncate font-mono text-sm font-extrabold tabular-nums text-white">{preview ? '345643' : liveAccount?.login ?? 'Not connected'}</span></span>
            </button>
            {accountConnected ? <button type="button" onClick={onSignOut} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-sm border border-white/15 px-3 text-[9px] font-extrabold uppercase tracking-[0.08em] text-white/75 transition-colors hover:border-primary/50 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><LogOut className="size-3.5" aria-hidden="true" />Disconnect</button> : <button type="button" onClick={onConnect} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-sm bg-primary px-3 text-[9px] font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Sign in <ArrowRight className="size-3.5" aria-hidden="true" /></button>}
          </div>
        </div>
        {accountConnected && <p className="mt-3 px-1 text-[9px] leading-relaxed text-white/40">{preview ? 'Preview account details only. Not connected to a broker.' : liveStatus?.terminal_connected ? liveStatus.message ?? 'EA confirmed the MT5 login.' : liveStatus?.message ?? 'Waiting for the MT5 EA to confirm the broker login.'}</p>}
      </section>
    </div>
  )
}

function ProfileView({ preview, mentorId, firstName, userEmail, onSignOut }: { preview: boolean; mentorId: string; firstName: string; userEmail: string | null; onSignOut: () => void }) {
  const displayName = preview ? 'Skud Student' : firstName || 'SkuD Turbo member'
  const displayEmail = preview ? 'student@example.com' : userEmail ?? 'Not available'
  const initials = (preview ? 'SS' : firstName || 'ST').slice(0, 2).toUpperCase()

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-5 sm:px-6">
      <section className="flex items-center gap-4 border-b border-border pb-6">
        <div className="flex size-16 items-center justify-center rounded-full bg-[#d8ede6] text-xl font-extrabold text-[#176b58]">
          {initials}
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold">{displayName}</h2>
          <p className="mt-1 break-all text-sm text-muted-foreground">{displayEmail}</p>
          {preview && <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.13em] text-primary">Preview profile</p>}
        </div>
      </section>

      <section aria-labelledby="membership-status" className="flex flex-col gap-4">
        <h2 id="membership-status" className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Membership access</h2>
        <div className="flex items-start justify-between gap-4 border-y border-border py-4">
          <div>
            <p className="text-sm font-extrabold">Pending admin approval</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">Your 30-day access period begins after an administrator approves your account.</p>
          </div>
          <span className="shrink-0 rounded-sm border border-[#e6b94f]/40 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#b28318]">Pending</span>
        </div>
      </section>

      <section aria-labelledby="profile-details" className="flex flex-col gap-3">
        <h2 id="profile-details" className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Personal details</h2>
        <dl className="divide-y divide-border border-y border-border text-sm">
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3"><dt className="text-muted-foreground">Full name</dt><dd className="break-all text-right font-semibold">{displayName}</dd></div>
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3"><dt className="text-muted-foreground">Email</dt><dd className="min-w-0 max-w-full break-all text-right font-semibold">{displayEmail}</dd></div>
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3"><dt className="text-muted-foreground">Following</dt><dd className="break-all text-right font-semibold">SkudTurbo</dd></div>
        </dl>
      </section>

      <button
        type="button"
        onClick={onSignOut}
        className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-sm border border-border px-4 text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <LogOut className="size-4" aria-hidden="true" />
        Sign out
      </button>
      {preview && <p className="text-[10px] text-muted-foreground">Profile details are sample UI. Account registration and approval are not connected yet.</p>}
    </div>
  )
}
