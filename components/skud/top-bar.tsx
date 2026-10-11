import Image from 'next/image'
import { DerivLogo } from './deriv-logo'

export function TopBar() {
  return (
    <header className="flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <DerivLogo />
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-foreground/80">
          SkuD <span className="text-primary">Turbo</span>
        </p>
      </div>
      <div className="relative">
        <div className="relative size-14 overflow-hidden rounded-2xl border-2 border-foreground/80 shadow-lg">
          <Image
            src="/images/skud-hero.jpg"
            alt="Skud profile picture"
            fill
            sizes="56px"
            className="object-cover object-[50%_12%] scale-[2.2] origin-[50%_10%]"
          />
        </div>
        <span
          className="absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-background bg-success"
          aria-label="Online"
          role="img"
        />
      </div>
    </header>
  )
}
