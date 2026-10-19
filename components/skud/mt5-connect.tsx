'use client'

import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getBrowserSupabase } from '@/lib/supabase'
import { DERIV_SERVERS } from '@/lib/mt5-servers'
import { saveStoredAccount } from './mt5-session'
import { loadClientSessionId } from './client-session'

export function Mt5ConnectDialog({
  open,
  onOpenChange,
  preview = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preview?: boolean
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formMessage, setFormMessage] = useState<string | null>(null)

  async function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (preview) return
    const form = event.currentTarget
    const formData = new FormData(form)
    const login = String(formData.get('login') ?? '').trim()
    const password = String(formData.get('password') ?? '')
    const server = String(formData.get('server') ?? '')
    setIsSubmitting(true)
    setFormMessage('Submitting account to the MT5 bridge...')

    try {
      const { data: sessionData } = await getBrowserSupabase().auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Sign in to your approved account before connecting MT5.')
      const response = await fetch('/api/mt5/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-access-token': accessToken,
          'x-session-id': loadClientSessionId() ?? '',
        },
        body: JSON.stringify({ login, password, server }),
      })
      const result = await response.json() as {
        error?: string
        login?: string
        server?: string
        statusToken?: string
      }
      if (!response.ok) throw new Error(result.error ?? 'Could not submit the MT5 account.')
      if (!result.login || !result.server || !result.statusToken) {
        throw new Error('The MT5 bridge returned incomplete account status details.')
      }

      saveStoredAccount({ login: result.login, server: result.server, statusToken: result.statusToken })
      form.reset()
      window.location.assign('/dashboard?portal=1')
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : 'Could not submit the MT5 account.')
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-0 right-0 max-h-[88dvh] w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-t-2xl border-white/10 bg-[#111114] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:right-auto sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:p-6"
      >
        <>
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold">Connect an MT5 account</DialogTitle>
              <DialogDescription className="text-white/55">
                Your credentials go straight to the Synthyard bridge over an encrypted connection. Your
                mentor never sees your MT5 login or password, and they are never stored in this app or
                displayed in the dashboard.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAccountSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="deriv-login" className="text-white/75">MT5 login</Label>
                <Input
                  id="deriv-login"
                  name="login"
                  inputMode="numeric"
                  pattern="[0-9]{5,12}"
                  placeholder="e.g. 34312794"
                  autoComplete="off"
                  required
                  className="h-11 border-white/15 bg-[#1a1a1e] text-white placeholder:text-white/35"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="deriv-password" className="text-white/75">MT5 trading password</Label>
                <div className="relative">
                  <Input
                    id="deriv-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    maxLength={128}
                    className="h-11 border-white/15 bg-[#1a1a1e] pr-12 text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide MT5 password' : 'Show MT5 password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-white/50 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring"
                  >
                    {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="deriv-server" className="text-white/75">Deriv server</Label>
                <select
                  id="deriv-server"
                  name="server"
                  required
                  defaultValue=""
                  className="h-11 w-full rounded-md border border-white/15 bg-[#1a1a1e] px-3 text-white outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50"
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
                disabled={isSubmitting || preview}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-extrabold text-white transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-wait disabled:opacity-60"
              >
                {preview ? 'Preview connection' : isSubmitting ? 'Connecting account...' : 'Connect MT5 account'}
              </button>
              {formMessage && <p role="status" className="text-xs leading-relaxed text-white/55">{formMessage}</p>}
            </form>
        </>
      </DialogContent>
    </Dialog>
  )
}
