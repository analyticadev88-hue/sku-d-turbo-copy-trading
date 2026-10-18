'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Eye, EyeOff, Share } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase'
import { DerivMark } from './deriv-logo'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type EntryState = 'loading' | 'install' | 'login'

function isInstalledPwa() {
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true
  return window.matchMedia('(display-mode: window-controls-overlay)').matches
}

export function AdminEntry() {
  const router = useRouter()
  const [state, setState] = useState<EntryState>('loading')
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const installWindow = window as Window & { __skudInstallPrompt?: BeforeInstallPromptEvent }

    const syncInstallPrompt = () => setInstallPrompt(installWindow.__skudInstallPrompt ?? null)
    const syncInstallState = () => setState(isInstalledPwa() ? 'login' : 'install')

    window.addEventListener('skud-install-available', syncInstallPrompt)
    window.addEventListener('appinstalled', () => {
      syncInstallPrompt()
      syncInstallState()
    })
    window.matchMedia('(display-mode: standalone)').addEventListener('change', syncInstallState)

    syncInstallPrompt()
    syncInstallState()

    let active = true
    async function checkSession() {
      try {
        const { data } = await getBrowserSupabase().auth.getSession()
        if (!active) return
        if (data.session) {
          router.replace('/dashboard')
          return
        }
        setState('login')
      } catch {
        if (active) setState('login')
      }
    }
    void checkSession()

    return () => {
      active = false
      window.removeEventListener('skud-install-available', syncInstallPrompt)
    }
  }, [router])

  if (state === 'install') {
    return <InstallScreen installPrompt={installPrompt} />
  }

  if (state === 'login') {
    return <LoginScreen />
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[#0b0b0d] px-5 text-white">
      <p role="status" className="text-sm text-white/60">Opening SkuD Turbo Admin…</p>
    </main>
  )
}

function InstallScreen({ installPrompt }: { installPrompt: BeforeInstallPromptEvent | null }) {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[#0b0b0d] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+1.25rem)] text-white sm:px-8">
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_15%,rgba(255,68,79,0.12),transparent_48%)]"
        aria-hidden="true"
      />
      <header className="mx-auto flex w-full max-w-lg items-center gap-3">
        <DerivMark className="size-10 rounded-xl text-xl" />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-extrabold leading-none">SkuD Turbo</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Admin</span>
        </span>
      </header>
      <section className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-10">
        <span className="mb-6 inline-flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-primary">
          {isIos ? <Share className="size-6" aria-hidden="true" /> : <Download className="size-6" aria-hidden="true" />}
        </span>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-primary">Admin platform</p>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight">Install SkuD Turbo Admin</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
          The admin platform only runs as an installed app. Install it on this device, then open it from
          your home screen to sign in.
        </p>
        {installPrompt ? (
          <button
            type="button"
            onClick={async () => {
              await installPrompt.prompt()
              await installPrompt.userChoice
              const installWindow = window as Window & { __skudInstallPrompt?: BeforeInstallPromptEvent }
              delete installWindow.__skudInstallPrompt
            }}
            className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-extrabold text-white transition-colors hover:bg-primary/85 sm:w-fit"
          >
            <Download className="size-4" aria-hidden="true" />
            Install app
          </button>
        ) : (
          <ol className="mt-7 flex flex-col gap-3 border-t border-white/10 pt-5 text-sm leading-relaxed text-white/60">
            {isIos ? (
              <>
                <li>1. Tap the <Share className="inline size-4 align-[-2px] text-white" aria-hidden="true" /> Share button in Safari.</li>
                <li>2. Scroll down and choose Add to Home Screen.</li>
                <li>3. Open SkuD Turbo Admin from your Home Screen and sign in.</li>
              </>
            ) : (
              <>
                <li>1. Open your browser menu (three dots in the top corner).</li>
                <li>2. Choose Install app or Add to Home screen.</li>
                <li>3. Open SkuD Turbo Admin from your apps and sign in.</li>
              </>
            )}
          </ol>
        )}
      </section>
    </main>
  )
}

function LoginScreen() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')

    try {
      const { error } = await getBrowserSupabase().auth.signInWithPassword({ email, password })
      if (error) throw error
      router.replace('/dashboard')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sign in. Check your details and try again.')
    } finally {
      setBusy(false)
    }
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
          <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.24em] text-primary">SkuD Turbo Admin</p>
        </div>
        <h1 className="mt-8 text-center text-3xl font-extrabold">Admin sign in</h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-white/55">
          Sign in with your admin account to open the platform.
        </p>
        <form onSubmit={handleSignIn} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-semibold text-white/75">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-11 rounded-md border border-white/15 bg-[#1a1a1e] px-3 text-white outline-none placeholder:text-white/35 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-white/75">
            Password
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className="h-11 w-full rounded-md border border-white/15 bg-[#1a1a1e] px-3 pr-12 text-white outline-none placeholder:text-white/35 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50"
              />
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
          <button
            type="submit"
            disabled={busy}
            className="mt-1 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-extrabold text-white transition-colors hover:bg-primary/85 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? 'Please wait...' : 'Sign in'}
          </button>
        </form>
        {message && (
          <p role="status" className="mt-4 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs leading-relaxed text-white/65">
            {message}
          </p>
        )}
      </section>
    </main>
  )
}
