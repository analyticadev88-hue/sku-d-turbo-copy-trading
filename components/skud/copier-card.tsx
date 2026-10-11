'use client'

import { ArrowDownRight, ArrowUpRight, Zap } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

const multipliers = [0.5, 1, 2, 3] as const
export type Multiplier = (typeof multipliers)[number]

const latestSignals = [
  { pair: 'XAUUSD', side: 'buy', lot: 0.2, time: '19:01' },
  { pair: 'EURUSD', side: 'sell', lot: 0.5, time: '18:42' },
  { pair: 'Volatility 75', side: 'buy', lot: 0.01, time: '18:15' },
] as const

type CopierCardProps = {
  enabled: boolean
  active: boolean
  multiplier: Multiplier
  onActiveChange: (active: boolean) => void
  onMultiplierChange: (multiplier: Multiplier) => void
}

export function CopierCard({
  enabled,
  active,
  multiplier,
  onActiveChange,
  onMultiplierChange,
}: CopierCardProps) {
  return (
    <article className="flex flex-col gap-5 rounded-[2rem] border border-border bg-card/90 p-6 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex size-10 items-center justify-center rounded-xl transition-colors',
              active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            <Zap className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-extrabold uppercase text-foreground">Turbo Copier</h2>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              {!enabled ? 'Link account to start' : active ? 'Mirroring Skud live' : 'Paused'}
            </p>
          </div>
        </div>
        <Switch
          checked={active}
          onCheckedChange={onActiveChange}
          disabled={!enabled}
          aria-label="Toggle copy trading"
        />
      </div>

      <fieldset className="flex flex-col gap-2" disabled={!enabled}>
        <legend className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Lot multiplier
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {multipliers.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onMultiplierChange(value)}
              aria-pressed={multiplier === value}
              className={cn(
                'h-10 rounded-xl border text-sm font-bold transition-colors disabled:opacity-40',
                multiplier === value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-muted text-foreground hover:border-foreground/30',
              )}
            >
              {value}x
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Latest signals
        </p>
        <ul className="flex flex-col divide-y divide-border">
          {latestSignals.map((signal) => {
            const isBuy = signal.side === 'buy'
            const Icon = isBuy ? ArrowUpRight : ArrowDownRight
            return (
              <li key={signal.pair + signal.time} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn('size-4', isBuy ? 'text-success' : 'text-primary')}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-bold text-foreground">{signal.pair}</span>
                  <span
                    className={cn(
                      'text-[10px] font-bold uppercase tracking-wider',
                      isBuy ? 'text-success' : 'text-primary',
                    )}
                  >
                    {signal.side}
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs tabular-nums text-muted-foreground">
                  <span>{(signal.lot * multiplier).toFixed(2)} lot</span>
                  <span>{signal.time}</span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </article>
  )
}
