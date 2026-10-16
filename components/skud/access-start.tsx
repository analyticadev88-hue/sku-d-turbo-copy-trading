'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Check, MapPin, X } from 'lucide-react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'

export function AccessStart() {
  const [open, setOpen] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [isStartingCheckout, setIsStartingCheckout] = useState(false)

  async function startCheckout() {
    setCheckoutError(null)
    setIsStartingCheckout(true)

    try {
      const response = await fetch('/api/payments/create', { method: 'POST' })
      const result = (await response.json()) as { invoiceUrl?: string; orderId?: string; error?: string }
      if (!response.ok || !result.invoiceUrl) {
        throw new Error(result.error ?? 'Could not start checkout. Please try again.')
      }

      if (result.orderId) window.localStorage.setItem('skud-payment-order', result.orderId)
      window.location.assign(result.invoiceUrl)
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : 'Could not start checkout. Please try again.',
      )
      setIsStartingCheckout(false)
    }
  }

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[#0b0b0d] text-white [--primary:#e4e4e7] [--primary-foreground:#09090b]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_20%,rgba(255,255,255,0.08),transparent_45%)]" aria-hidden="true" />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
        <Link href="/" aria-label="Synthyard EA Hosting home" className="inline-flex items-center gap-3">
          <Image src="/logo-synth.webp" alt="" width={44} height={44} className="size-10 rounded-xl object-cover" />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-extrabold uppercase leading-none text-white">Synthyard</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/65">
              EA Hosting
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
            onClick={() => {
              setCheckoutError(null)
              setOpen(true)
            }}
            className="mt-9 inline-flex min-h-14 items-center gap-8 rounded-md bg-primary px-6 text-sm font-extrabold uppercase tracking-[0.12em] text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Get access
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 pb-5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/45 sm:px-8">
        <span>© Synthyard EA Hosting</span>
        <Link href="/dashboard?login=1" className="transition-colors hover:text-white">Approved user? Sign in</Link>
      </footer>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm transition-opacity data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <DialogPrimitive.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-white/10 bg-[#111114] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 text-white shadow-[0_-24px_90px_rgba(0,0,0,0.55)] outline-none animate-in slide-in-from-bottom-6 duration-300 sm:px-8 sm:pt-5">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-primary">
                  Synthyard EA Hosting
                </p>
                <DialogPrimitive.Title className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">
                  Get hosting access
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-2 max-w-lg text-sm leading-relaxed text-white/60">
                  The one-time setup fee starts preparation of your dedicated MT5 EA hosting and server access.
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close
                aria-label="Close access details"
                className="-mr-2 -mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-white/65 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
              >
                <X className="size-5" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>

            <div className="relative mt-6 overflow-hidden rounded-xl border border-white/15 bg-[#202024] p-5 sm:p-6">
              <div
                className="pointer-events-none absolute -right-10 -top-14 size-48 rounded-full border border-white/5"
                aria-hidden="true"
              />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Image src="/logo-synth.webp" alt="" width={40} height={40} className="size-10 rounded-xl object-cover" />
                  <div>
                    <p className="text-sm font-extrabold uppercase">Synthyard</p>
                    <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-white/45">
                      EA hosting
                    </p>
                  </div>
                </div>
                <span className="rounded-sm border border-white/15 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-white/65">
                  Dedicated MT5
                </span>
              </div>
              <div className="relative mt-9 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/45">
                    MT5 EA hosting + server access
                  </p>
                  <p className="mt-1 text-3xl font-extrabold tracking-tight">$13</p>
                </div>
                <div className="flex h-8 items-center gap-1.5 pb-1" aria-label="Secure payment">
                  <span className="size-5 rounded-full bg-primary" />
                  <span className="-ml-2 size-5 rounded-full bg-white/75" />
                </div>
              </div>
            </div>

            <div className="mt-5 divide-y divide-white/10 border-y border-white/10">
              <div className="flex items-center justify-between gap-4 py-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-white/5 text-primary">
                    <MapPin className="size-[18px]" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-bold">Germany server</p>
                    <p className="mt-0.5 text-xs text-white/50">Frankfurt, DE</p>
                  </div>
                </div>
                <span className="flex h-4 w-6 flex-col overflow-hidden rounded-[2px]" aria-label="Germany">
                  <span className="h-1/3 bg-black" />
                  <span className="h-1/3 bg-[#dd0000]" />
                  <span className="h-1/3 bg-[#ffce00]" />
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 py-4 text-sm">
                <span className="text-white/60">One-time setup fee</span>
                <span className="font-bold">$13.00 USD</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-4 text-sm">
                <span className="font-bold">Total due</span>
                <span className="text-lg font-extrabold">$13.00 USD</span>
              </div>
            </div>

            <button
              type="button"
              onClick={startCheckout}
              disabled={isStartingCheckout}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-extrabold text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-70"
            >
              {isStartingCheckout ? 'Preparing secure checkout...' : 'Continue to hosting payment — $13'}
              {!isStartingCheckout && <ArrowRight className="size-4" aria-hidden="true" />}
            </button>
            {checkoutError ? (
              <p role="alert" className="mt-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-center text-xs leading-relaxed text-white/80">
                {checkoutError}
              </p>
            ) : (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] leading-relaxed text-white/45">
                <Check className="size-3.5 text-success" aria-hidden="true" />
                Secure checkout is provided by NOWPayments. Account setup continues after payment confirmation and mentor approval.
              </p>
            )}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </main>
  )
}