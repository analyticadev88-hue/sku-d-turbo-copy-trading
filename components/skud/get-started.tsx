'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase'
import { DerivMark } from './deriv-logo'
import { Mt5ConnectDialog } from './mt5-connect'

export function GetStarted() {
  const [isConnectOpen, setIsConnectOpen] = useState(false)

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
              Copy trading
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

      <section className="mx-auto flex w-full max-w-6xl flex-1 items-center px-5 py-10 sm:px-8 sm:py-16">
        <div className="max-w-2xl">
          <p className="mb-5 flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.24em] text-primary">
            <span className="h-px w-8 bg-primary" />
            You're in
          </p>
          <h1 className="max-w-xl text-balance text-4xl font-extrabold uppercase leading-[0.98] sm:text-6xl">
            Welcome to SkuD Turbo.
          </h1>
          <p className="mt-6 max-w-lg text-pretty leading-relaxed text-white/65">
            Your hosting is active and your account is approved. Connect your Deriv MT5 account to start copy trading.
          </p>

          <button
            type="button"
            onClick={() => setIsConnectOpen(true)}
            className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-md bg-primary px-5 text-sm font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
          >
            Get started
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>

          <p className="mt-5 max-w-lg text-xs leading-relaxed text-white/45">
            Your password is sent to the managed bridge to start the MT5 terminal. The dashboard shows your balance only after the Student EA confirms the broker login.
          </p>
        </div>
      </section>

      <Mt5ConnectDialog open={isConnectOpen} onOpenChange={setIsConnectOpen} />
    </main>
  )
}
