'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Eye, EyeOff } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DerivMark } from './deriv-logo'

const DERIV_SERVERS = [
  'Deriv-Demo',
  'DerivBVI-Demo',
  'DerivSVG-Demo',
  'DerivSVG-Server',
  'DerivSVG-Server-02',
  'DerivSVG-Server-03',
  'DerivBVI-Server',
  'DerivBVI-Server-02',
  'DerivBVI-Server-03',
]

export function CheckoutReturn() {
  const [isConnectOpen, setIsConnectOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    form.reset()
    window.location.assign('/dashboard?preview=1')
  }

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_15%,rgba(255,68,79,0.12),transparent_48%)]"
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
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/45">
          Account access
        </span>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 items-center px-5 py-16 sm:px-8">
        <div className="max-w-2xl">
          <p className="mb-5 flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.24em] text-primary">
            <span className="h-px w-8 bg-primary" />
            Account access 
          </p>
          <h1 className="max-w-xl text-balance text-4xl font-extrabold uppercase leading-[0.98] sm:text-6xl">
            Connect your MT5 student account.
          </h1>
          <p className="mt-6 max-w-lg text-pretty leading-relaxed text-foreground/65">
            Connect a Deriv MT5 demo account to your SkuD Turbo student terminal.
          </p>

          <button
            type="button"
            onClick={() => {
              setShowPassword(false)
              setIsConnectOpen(true)
            }}
            className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-md bg-primary px-5 text-sm font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
          >
            Connect MT5 account
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </button>

          <p className="mt-5 max-w-lg text-xs leading-relaxed text-foreground/45">
            This checkout return does not confirm payment. MT5 demo credentials are sent to the managed student bridge for terminal login.
          </p>
        </div>
      </section>

      <Dialog open={isConnectOpen} onOpenChange={setIsConnectOpen}>
        <DialogContent className="border-border bg-card p-6 text-card-foreground sm:max-w-md">
          <>
              <DialogHeader>
                <DialogTitle className="text-xl font-extrabold">Connect an MT5 account</DialogTitle>
                <DialogDescription>
                  This is a dashboard preview step. Your account details will not be sent or saved yet.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAccountSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="deriv-login">MT5 login</Label>
                  <Input
                    id="deriv-login"
                    name="login"
                    inputMode="numeric"
                    pattern="[0-9]{5,12}"
                    placeholder="e.g. 34312794"
                    autoComplete="off"
                    required
                    className="h-11"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="deriv-password">MT5 trading password</Label>
                  <div className="relative">
                    <Input
                      id="deriv-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      maxLength={128}
                      className="h-11 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? 'Hide MT5 password' : 'Show MT5 password'}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring"
                    >
                      {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="deriv-server">Deriv server</Label>
                  <select
                    id="deriv-server"
                    name="server"
                    required
                    defaultValue=""
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="" disabled>
                      Choose your server
                    </option>
                    {DERIV_SERVERS.map((server) => (
                      <option key={server} value={server}>
                        {server}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-extrabold text-white transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                >
                  Open dashboard preview
                </button>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Preview only. No MT5 connection is started and no credentials leave this page.
                </p>
              </form>
          </>
        </DialogContent>
      </Dialog>
    </main>
  )
}