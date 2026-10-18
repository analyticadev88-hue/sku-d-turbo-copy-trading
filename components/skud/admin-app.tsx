'use client'

import { useState } from 'react'
import { useEffect } from 'react'
import Link from 'next/link'
import { Cable, Download, LineChart, Share, Users } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase'
import { DerivMark } from './deriv-logo'
import { AdminClients } from './admin-clients'
import { AdminMt5 } from './admin-mt5'
import { AdminTrade } from './admin-trade'

export type AdminTab = 'home' | 'clients' | 'mt5'

const TABS: { id: AdminTab; label: string; icon: typeof LineChart }[] = [
  { id: 'home', label: 'Home', icon: LineChart },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'mt5', label: 'MT5', icon: Cable },
]

export function AdminApp() {
  const [tab, setTab] = useState<AdminTab>('home')
  const [installed, setInstalled] = useState<boolean | null>(null)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const installWindow = window as Window & { __skudInstallPrompt?: BeforeInstallPromptEvent }
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const isInstalled = () => displayMode.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
    const updateInstalled = () => setInstalled(isInstalled())
    const updatePrompt = () => setInstallPrompt(installWindow.__skudInstallPrompt ?? null)

    updateInstalled()
    updatePrompt()
    displayMode.addEventListener('change', updateInstalled)
    window.addEventListener('skud-install-available', updatePrompt)
    window.addEventListener('appinstalled', updateInstalled)
    return () => {
      displayMode.removeEventListener('change', updateInstalled)
      window.removeEventListener('skud-install-available', updatePrompt)
      window.removeEventListener('appinstalled', updateInstalled)
    }
  }, [])

  if (installed === null) {
    return <main className="grid min-h-dvh place-items-center bg-[#0b0b0d] text-sm text-white/55">Loading admin app…</main>
  }

  if (!installed) {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    return (
      <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[#0b0b0d] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+1.25rem)] text-white sm:px-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_15%,rgba(255,68,79,0.12),transparent_48%)]" aria-hidden="true" />
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
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-primary">Admin access</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight">Install SkuD Turbo</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
            Install the app on this device to open the admin workspace.
          </p>
          {installPrompt ? (
            <button
              type="button"
              onClick={async () => {
                await installPrompt.prompt()
                await installPrompt.userChoice
                const installWindow = window as Window & { __skudInstallPrompt?: BeforeInstallPromptEvent }
                delete installWindow.__skudInstallPrompt
                setInstallPrompt(null)
              }}
              className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-extrabold text-white transition-colors hover:bg-primary/85 sm:w-fit"
            >
              <Download className="size-4" aria-hidden="true" />
              Install app
            </button>
          ) : (
            <div className="mt-7 border-t border-white/10 pt-5">
              <p className="text-sm font-bold">{isIos ? 'On iPhone or iPad' : 'In your browser'}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                {isIos
                  ? 'Tap Share, then choose Add to Home Screen. Open SkuD Turbo from your Home Screen after it is added.'
                  : 'Open the browser menu and choose Install app or Add to Home screen. Then open SkuD Turbo from your apps.'}
              </p>
            </div>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-x-hidden bg-[#0b0b0d] text-white">
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_15%,rgba(255,68,79,0.12),transparent_48%)]"
        aria-hidden="true"
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pb-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-8 sm:pb-7 sm:pt-[calc(env(safe-area-inset-top)+1.75rem)]">
        <Link href="/" aria-label="SkuD Turbo home" className="inline-flex items-center gap-3">
          <DerivMark className="size-10 rounded-xl text-xl" />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-extrabold leading-none">SkuD Turbo</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
              Admin
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

      <div className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 sm:px-8 sm:pt-6">
        {tab === 'home' && <AdminTrade switchTab={setTab} />}
        {tab === 'clients' && <AdminClients />}
        {tab === 'mt5' && <AdminMt5 switchTab={setTab} />}
      </div>

      <nav aria-label="Admin navigation" className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-3">
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#111114]/95 px-2 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.14em] transition-all ${tab === id ? 'bg-primary text-white' : 'text-white/55 hover:text-white'}`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  )
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
