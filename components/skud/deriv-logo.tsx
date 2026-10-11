import { cn } from '@/lib/utils'

export function DerivMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-lg bg-primary text-lg font-extrabold leading-none text-primary-foreground',
        className,
      )}
    >
      d
    </span>
  )
}

export function DerivLogo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <DerivMark />
      <span className="text-2xl font-extrabold lowercase tracking-tight text-foreground">
        deriv
      </span>
      <span className="sr-only">Deriv</span>
    </span>
  )
}
