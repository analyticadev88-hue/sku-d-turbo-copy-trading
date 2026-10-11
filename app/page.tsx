import { Hero } from '@/components/home/hero'
import { Ticker } from '@/components/home/ticker'
import { Founder } from '@/components/home/founder'
import { Robot } from '@/components/home/robot'
import { DerivLogo } from '@/components/skud/deriv-logo'

export default function HomePage() {
  return (
    <>
      <main>
        <Hero />
        <Ticker />
        <Founder />
        <Robot />
      </main>
      <footer className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-12 md:px-10">
        <div className="flex items-center justify-between gap-4">
          <DerivLogo />
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-foreground/50">
            © SkuD <span className="text-primary">Turbo</span>
          </p>
        </div>
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Risk warning: Trading forex and CFDs on margin carries a high level of risk and may not be
          suitable for all investors. Past performance does not guarantee future results. Only trade
          with money you can afford to lose.
        </p>
      </footer>
    </>
  )
}
