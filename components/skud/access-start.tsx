'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SynthyardCheckoutDialog } from './synthyard-checkout'

export function AccessStart() {
  const [open, setOpen] = useState(false)

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[#0b0b0d] text-white [--primary:#e4e4e7] [--primary-foreground:#09090b]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_20%,rgba(255,255,255,0.08),transparent_45%)]" aria-hidden="true" />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
        <Link href="/" aria-label="SkuD Turbo home" className="inline-flex items-center gap-3">
          <Image src="/logo-synth.webp" alt="" width={44} height={44} className="size-10 rounded-xl object-cover" />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-extrabold uppercase leading-none text-white">SkuD</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/65">
              Turbo
            </span>
          </span>
        </Link>
        <Link
          href="/"
          className="text-xs font-bold uppercase tracking-[0.18em] text-white/65 transition-colors hover:text-white"
        >
          Back to home
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-7xl flex-1 items-end px-5 pb-16 pt-20 sm:px-8 sm:pb-24 lg:items-center lg:pb-28">
        <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-3 duration-700">
          <p className="mb-5 flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/80">
            <span className="h-px w-8 bg-primary" />
            Dedicated trading infrastructure
          </p>
          <h1 className="max-w-xl text-balance text-5xl font-extrabold uppercase leading-[0.92] text-white sm:text-7xl">
            Your next move.
            <br />
            <span className="text-white">Made automatic.</span>
          </h1>
          <p className="mt-6 max-w-lg text-pretty text-base leading-relaxed text-white/75 sm:text-lg">
            Get your Expert Advisor hosted on a dedicated MT5 server with managed setup and hosting.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-9 inline-flex min-h-14 items-center gap-8 rounded-md bg-primary px-6 text-sm font-extrabold uppercase tracking-[0.12em] text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Get access
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-7xl items-center justify-center px-5 pb-5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/45 sm:px-8">
        <span>© SkuD Turbo</span>
      </footer>

      <SynthyardCheckoutDialog open={open} onOpenChange={setOpen} />
    </main>
  )
}
