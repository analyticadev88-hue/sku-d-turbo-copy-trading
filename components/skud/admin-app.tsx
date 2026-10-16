'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Cable, GraduationCap, LineChart, Users } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase'
import { DerivMark } from './deriv-logo'
import { AdminClients } from './admin-clients'
import { AdminMentors } from './admin-mentors'
import { AdminMt5 } from './admin-mt5'
import { AdminTrade } from './admin-trade'

export type AdminTab = 'home' | 'clients' | 'mentors' | 'mt5'

const TABS: { id: AdminTab; label: string; icon: typeof LineChart }[] = [
  { id: 'home', label: 'Home', icon: LineChart },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'mentors', label: 'Mentors', icon: GraduationCap },
  { id: 'mt5', label: 'MT5', icon: Cable },
]

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
        {tab === 'home' && <AdminTrade switchTab={setTab} />}
        {tab === 'clients' && <AdminClients />}
        {tab === 'mentors' && <AdminMentors />}
        {tab === 'mt5' && <AdminMt5 switchTab={setTab} />}
      </div>

      <nav aria-label="Admin navigation" className="fixed inset-x-0 bottom-4 z-30 flex justify-center">
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
