'use client'

import Image from 'next/image'
import Link from 'next/link'
import { InstallGuide } from '@/components/pwa/install-app-dialog'

export function InstallRequired() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[#0b0b0d] text-white">
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_20%,rgba(255,255,255,0.08),transparent_45%)]"
        aria-hidden="true"
      />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
        <Link href="/" aria-label="SkuD Turbo home" className="inline-flex items-center gap-3">
          <Image src="/logo-synth.webp" alt="" width={44} height={44} className="size-10 rounded-xl object-cover" />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-extrabold uppercase leading-none text-white">SkuD</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/65">Turbo</span>
          </span>
        </Link>
        <Link
          href="/"
          className="text-xs font-bold uppercase tracking-[0.18em] text-white/65 transition-colors hover:text-white"
        >
          Back to home
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-5 px-5 pb-16 pt-10 text-center sm:px-8">
        <Image
          src="/logo-synth.webp"
          alt="SkuD Turbo"
          width={72}
          height={72}
          priority
          className="size-16 rounded-2xl object-cover"
        />
        <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-white/75">SkuD Turbo</p>
        <h1 className="max-w-md text-balance text-3xl font-extrabold leading-tight sm:text-4xl">
          Install the app to continue
        </h1>
        <p className="max-w-sm text-pretty text-sm leading-relaxed text-white/55">
          SkuD Turbo only runs as an installed app. Install it free on your device, then sign in with your
          mentor-approved account.
        </p>
        <div className="mt-2 w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5">
          <InstallGuide />
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-7xl items-center justify-center px-5 pb-5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/45 sm:px-8">
        <span>© SkuD Turbo</span>
      </footer>
    </main>
  )
}
