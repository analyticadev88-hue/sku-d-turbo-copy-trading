'use client'

import { useState } from 'react'
import { RefreshCw, TrendingUp } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ConnectionStatus = 'idle' | 'verifying' | 'connected'

export type DerivAccount = {
  login: string
  server: string
}

type ConnectionCardProps = {
  account: DerivAccount | null
  status: ConnectionStatus
  preview?: boolean
  onConnect: (account: DerivAccount) => void
  onRefresh: () => void
}

const statusCopy: Record<ConnectionStatus, { label: string; tone: string; dot: string }> = {
  idle: { label: 'Not linked', tone: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  verifying: { label: 'Verifying...', tone: 'text-primary', dot: 'bg-primary animate-pulse' },
  connected: { label: 'Connected', tone: 'text-success', dot: 'bg-success' },
}

export function ConnectionCard({ account, status, preview = false, onConnect, onRefresh }: ConnectionCardProps) {
  const [open, setOpen] = useState(false)
  const copy = statusCopy[status]

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const login = String(data.get('login') ?? '').trim()
    const server = String(data.get('server') ?? '').trim()
    if (!/^\d{5,12}$/.test(login) || !server) return
    onConnect({ login, server })
    setOpen(false)
  }

  return (
    <article className="relative overflow-hidden rounded-[2rem] border border-border bg-card shadow-2xl shadow-background/60">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-primary"
        style={{ clipPath: 'polygon(0 0, 66% 0, 44% 100%, 0 100%)' }}
      />
      <div className="relative grid min-h-56 grid-cols-2 p-6">
        <div className="flex flex-col justify-between gap-6">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/75">
              Terminal
            </p>
            <h2 className="text-2xl font-extrabold leading-tight text-primary-foreground text-balance">
              Deriv MT5 Account
            </h2>
          </div>

          {preview ? (
            <span className="inline-flex w-fit items-center gap-2 border-b border-primary-foreground/50 pb-0.5 text-sm font-bold text-primary-foreground/60">
              Connection setup unavailable in preview
            </span>
          ) : <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <button
                  type="button"
                  className="inline-flex w-fit items-center gap-2 border-b border-primary-foreground/70 pb-0.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-80"
                />
              }
            >
              {account ? 'Reconfigure' : 'Configure now'}
              <TrendingUp className="size-4" aria-hidden="true" />
            </DialogTrigger>
            <DialogContent className="border-border bg-card text-card-foreground sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Link your Deriv MT5 account</DialogTitle>
                <DialogDescription>
                  Enter the MT5 login and server from your Deriv dashboard. SkuD Turbo only needs
                  trading access to mirror positions.
                </DialogDescription>
              </DialogHeader>
              <form
                key={account?.login ?? 'new'}
                onSubmit={handleSubmit}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="login">MT5 login</Label>
                  <Input
                    id="login"
                    name="login"
                    inputMode="numeric"
                    pattern="\d{5,12}"
                    placeholder="e.g. 34312794"
                    defaultValue={account?.login}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="server">Server</Label>
                  <Input
                    id="server"
                    name="server"
                    placeholder="DerivSVG-Server"
                    defaultValue={account?.server ?? 'DerivSVG-Server'}
                    required
                  />
                </div>
                <Button type="submit" className="h-11 rounded-xl font-bold">
                  Connect account
                </Button>
              </form>
            </DialogContent>
          </Dialog>}
        </div>

        <div className="flex flex-col items-end justify-between gap-6 text-right">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Broker
            </p>
            <p className="text-xl font-extrabold text-foreground">Deriv</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Login
            </p>
            <p className="font-mono text-xl font-bold tabular-nums text-foreground">
              {account?.login ?? '— — —'}
            </p>
            <div className="flex items-center gap-2">
              <span className={cn('size-2 rounded-full', copy.dot)} aria-hidden="true" />
              <span
                className={cn('text-[11px] font-bold uppercase tracking-[0.15em]', copy.tone)}
                aria-live="polite"
              >
                {copy.label}
              </span>
              {account && (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Re-verify connection"
                >
                  <RefreshCw
                    className={cn('size-3.5', status === 'verifying' && 'animate-spin')}
                    aria-hidden="true"
                  />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
