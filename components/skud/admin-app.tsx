'use client'

import { useState } from 'react'
import Link from 'next/link'
import { House, Users } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase'
import { DerivMark } from './deriv-logo'
import { AdminClients } from './admin-clients'
import { AdminTrade } from './admin-trade'

type AdminTab = 'home' | 'clients'

export function AdminApp() {
  const [tab, setTab] = useState<AdminTab>('home')

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[#0b0b0d] text-white">
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_15%,rgba(255,68,79,0.12),transparent_48%)]"
        aria-hidden="true"
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
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

      <div className="mx-auto w-full max-w-6xl flex-1 px-5 pb-28 pt-6 sm:px-8">
        {tab === 'home' ? <AdminTrade /> : <AdminClients />}
      </div>

      <nav
        aria-label="Admin navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#111114]/95 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setTab('home')}
            aria-current={tab === 'home' ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-extrabold uppercase tracking-[0.15em] transition-all ${tab === 'home' ? 'bg-primary text-white' : 'text-white/55 hover:text-white'}`}
          >
            <House className="size-4" aria-hidden="true" />
            Home
          </button>
          <button
            type="button"
            onClick={() => setTab('clients')}
            aria-current={tab === 'clients' ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-extrabold uppercase tracking-[0.15em] transition-all ${tab === 'clients' ? 'bg-primary text-white' : 'text-white/55 hover:text-white'}`}
          >
            <Users className="size-4" aria-hidden="true" />
            Clients
          </button>
        </div>
      </nav>
    </main>
  )
}
