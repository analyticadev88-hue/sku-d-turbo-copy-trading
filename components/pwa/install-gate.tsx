'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, MonitorDown, RefreshCw, Share, Smartphone } from 'lucide-react'
import { DerivMark } from '@/components/skud/deriv-logo'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'android' | 'ios' | 'desktop'

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'desktop'
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function InstallGate() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [platform, setPlatform] = useState<Platform>('desktop')
  const [rechecking, setRechecking] = useState(false)

  useEffect(() => {
    setPlatform(detectPlatform())
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  function recheck() {
    setRechecking(true)
    // Give the browser a beat if the user just completed the install flow.
    setTimeout(() => {
      if (isStandalone()) {
        window.location.reload()
      } else {
        setRechecking(false)
      }
    }, 600)
  }

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_10%,rgba(255,68,79,0.14),transparent_50%)]"
        aria-hidden="true"
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
        <Link href="/" aria-label="SkuD Turbo home" className="inline-flex items-center gap-3">
          <DerivMark className="size-10 rounded-xl text-xl" />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-extrabold lowercase leading-none">deriv</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/60">
              SkuD Turbo
            </span>
          </span>
        </Link>
        <Link
          href="/"
          className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/55 transition-colors hover:text-foreground"
        >
          Back to home
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 items-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-3 duration-700">
          <p className="mb-5 flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.24em] text-primary">
            <span className="h-px w-8 bg-primary" />
            App required
          </p>
          <h1 className="max-w-xl text-balance text-4xl font-extrabold uppercase leading-[0.95] sm:text-6xl">
            Install the app to continue.
          </h1>
          <p className="mt-5 max-w-lg text-pretty text-sm leading-relaxed text-foreground/65 sm:text-base">
            Payments and MT5 account connections are only available inside the installed SkuD Turbo
            app. Install it once, then sign in straight from your home screen.
          </p>

          <div className="mt-8 rounded-xl border border-border bg-card p-5 sm:p-6">
            {platform === 'ios' ? (
              <ol className="flex flex-col gap-4 text-sm leading-relaxed">
                <li className="flex items-start gap-3">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">1</span>
                  <span>
                    Tap the <Share className="inline size-4 align-[-3px]" aria-label="Share" />{' '}
                    <span className="font-bold">Share</span> button in Safari&apos;s toolbar.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">2</span>
                  <span>
                    Scroll down and tap <span className="font-bold">Add to Home Screen</span>.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">3</span>
                  <span>
                    Open <span className="font-bold">SkuD Turbo</span> from your home screen and
                    continue.
                  </span>
                </li>
              </ol>
            ) : platform === 'android' ? (
              <ol className="flex flex-col gap-4 text-sm leading-relaxed">
                <li className="flex items-start gap-3">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">1</span>
                  <span>
                    {deferred
                      ? 'Tap the Install button below.'
                      : <>Open your browser&apos;s <span className="font-bold">⋮ menu</span> and choose <span className="font-bold">Install app</span> or <span className="font-bold">Add to Home screen</span>.</>}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">2</span>
                  <span>
                    Open <span className="font-bold">SkuD Turbo</span> from your home screen and
                    continue.
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="flex flex-col gap-4 text-sm leading-relaxed">
                <li className="flex items-start gap-3">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">1</span>
                  <span>
                    Click the <MonitorDown className="inline size-4 align-[-3px]" aria-label="Install icon" />{' '}
                    install icon in your browser&apos;s address bar (or the menu →{' '}
                    <span className="font-bold">Install SkuD Turbo</span>).
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">2</span>
                  <span>
                    Launch <span className="font-bold">SkuD Turbo</span> from your apps menu and
                    continue.
                  </span>
                </li>
              </ol>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            {deferred && (
              <button
                type="button"
                onClick={install}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
              >
                <Download className="size-4" aria-hidden="true" />
                Install now
              </button>
            )}
            <button
              type="button"
              onClick={recheck}
              disabled={rechecking}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-border px-5 text-sm font-extrabold uppercase tracking-[0.1em] text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground disabled:opacity-60"
            >
              <RefreshCw className={`size-4 ${rechecking ? 'animate-spin' : ''}`} aria-hidden="true" />
              {rechecking ? 'Checking...' : "I've installed it — open the app"}
            </button>
          </div>

          <p className="mt-5 flex items-center gap-2 text-[11px] leading-relaxed text-foreground/45">
            <Smartphone className="size-3.5 shrink-0" aria-hidden="true" />
            Installed already? Open SkuD Turbo from your home screen instead of the browser.
          </p>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pb-5 text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/40 sm:px-8">
        <span>© SkuD Turbo</span>
        <span>Powered by Deriv</span>
      </footer>
    </main>
  )
}
