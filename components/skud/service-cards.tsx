import Image from 'next/image'
import { CreditCard, LifeBuoy } from 'lucide-react'
import { DerivMark } from './deriv-logo'

export function MembershipCard() {
  return (
    <a
      href="#membership"
      className="group relative flex min-h-44 overflow-hidden rounded-[2rem] border border-border bg-card transition-transform active:scale-[0.99]"
    >
      <div className="relative z-10 flex flex-1 flex-col justify-center gap-4 p-6">
        <CreditCard className="size-6 text-muted-foreground" aria-hidden="true" />
        <div>
          <h3 className="text-xl font-extrabold uppercase text-foreground">Membership</h3>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Manage billing
          </p>
        </div>
      </div>
      <div
        className="absolute inset-y-0 right-0 flex w-[42%] items-center justify-center bg-secondary"
        style={{ clipPath: 'polygon(6% 0, 100% 0, 100% 100%, 0 100%)' }}
      >
        <DerivMark className="size-16 rounded-2xl text-4xl transition-transform group-hover:scale-105" />
      </div>
    </a>
  )
}

export function HelpCard() {
  return (
    <a
      href="#support"
      className="group relative flex min-h-44 overflow-hidden rounded-[2rem] border border-border transition-transform active:scale-[0.99]"
    >
      <Image
        src="/images/support.png"
        alt=""
        fill
        sizes="(max-width: 480px) 100vw, 448px"
        className="object-cover blur-[2px] transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-background/55" aria-hidden="true" />
      <div className="relative flex flex-col justify-center gap-4 p-6">
        <LifeBuoy className="size-6 text-foreground/80" aria-hidden="true" />
        <div>
          <h3 className="text-xl font-extrabold uppercase text-foreground">Get Help</h3>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/75">
            Live tech support chat
          </p>
        </div>
      </div>
    </a>
  )
}
