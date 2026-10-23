import Image from 'next/image'
import { InstallAppButton } from '@/components/pwa/install-app-button'
import { DerivLogo } from '@/components/skud/deriv-logo'

export function Hero() {
  return (
    <section className="relative isolate flex min-h-dvh flex-col overflow-hidden" aria-labelledby="hero-title">
      <Image
        src="/images/herodesk.png"
        alt="The SkuD Turbo app running a Deriv MT5 account on mobile"
        fill
        sizes="100vw"
        className="-z-10 hidden object-cover object-center md:block"
      />
      <Image
        src="/images/skud-hero.jpg"
        alt="Skud, founder of SkuD Turbo, standing in front of his car"
        fill
        sizes="100vw"
        className="-z-10 object-cover object-[50%_20%] md:hidden"
      />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-background/60 via-background/10 to-background"
        aria-hidden="true"
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6 md:px-10">
        <DerivLogo />
      </header>

      <div className="mx-auto mt-auto flex w-full max-w-6xl flex-col gap-6 px-5 pb-12 md:px-10 md:pb-16">
        <p className="w-fit rounded-sm bg-primary px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.3em] text-primary-foreground">
          Automated forex robot
        </p>
        <h1
          id="hero-title"
          className="text-balance text-6xl font-extrabold uppercase leading-[0.85] tracking-tighter text-foreground md:text-8xl lg:text-9xl"
        >
          SkuD
          <br />
          <span className="text-primary">Turbo</span>
        </h1>
        <p className="max-w-md text-pretty text-base leading-relaxed text-foreground/85">
          The trading robot built by Skud — a forex pioneer — running his proven strategy
          directly on your Deriv MT5 account, around the clock.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <InstallAppButton
            label="Install the app"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-extrabold uppercase tracking-wider text-primary-foreground transition-transform hover:scale-[1.03]"
          />
          <a
            href="#founder"
            className="rounded-full px-5 py-3.5 text-sm font-bold uppercase tracking-wider text-foreground underline-offset-4 hover:underline"
          >
            Meet Skud
          </a>
        </div>
      </div>
    </section>
  )
}
