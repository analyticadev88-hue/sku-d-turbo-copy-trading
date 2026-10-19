'use client'

import type { ReactNode } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Check, Download, MoreVertical, Share, X } from 'lucide-react'
import { detectIos, detectMobile, usePwaInstall } from './use-pwa-install'

function Step({ index, children }: { index: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-left">
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-extrabold text-white">
        {index}
      </span>
      <p className="text-sm leading-relaxed text-white/70">{children}</p>
    </li>
  )
}

export function InstallGuide() {
  const { installed, canPrompt, justInstalled, promptInstall } = usePwaInstall()
  const ios = detectIos()
  const mobile = detectMobile()

  if (installed || justInstalled) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="size-6" aria-hidden="true" />
        </span>
        <p className="text-base font-extrabold text-white">SkuD Turbo is installed</p>
        <p className="max-w-xs text-sm leading-relaxed text-white/55">
          Open it from your home screen or app drawer, then sign in with your approved account.
        </p>
        <a
          href="/dashboard"
          className="mt-1 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-extrabold text-primary-foreground transition-colors hover:bg-primary/85"
        >
          Open SkuD Turbo
        </a>
      </div>
    )
  }

  if (canPrompt) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="max-w-xs text-sm leading-relaxed text-white/55">
          Add SkuD Turbo to your device for the full-screen trading dashboard. Free to install.
        </p>
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-extrabold text-primary-foreground transition-colors hover:bg-primary/85"
        >
          <Download className="size-4" aria-hidden="true" />
          Install now
        </button>
      </div>
    )
  }

  if (ios) {
    return (
      <ol className="flex flex-col gap-3">
        <Step index={1}>
          Open this site in <span className="font-semibold text-white">Safari</span> and tap the{' '}
          <Share className="inline size-3.5 align-[-2px]" aria-label="Share" /> share button.
        </Step>
        <Step index={2}>
          Scroll down and tap <span className="font-semibold text-white">Add to Home Screen</span>.
        </Step>
        <Step index={3}>
          Tap <span className="font-semibold text-white">Add</span> — then open SkuD Turbo from your home screen.
        </Step>
      </ol>
    )
  }

  if (mobile) {
    return (
      <ol className="flex flex-col gap-3">
        <Step index={1}>
          Open this site in <span className="font-semibold text-white">Chrome</span> and tap the{' '}
          <MoreVertical className="inline size-3.5 align-[-2px]" aria-label="menu" /> menu.
        </Step>
        <Step index={2}>
          Tap <span className="font-semibold text-white">Add to Home screen</span> or{' '}
          <span className="font-semibold text-white">Install app</span>.
        </Step>
        <Step index={3}>
          Tap <span className="font-semibold text-white">Install</span> — then open SkuD Turbo from your home screen.
        </Step>
      </ol>
    )
  }

  return (
    <ol className="flex flex-col gap-3">
      <Step index={1}>
        Use <span className="font-semibold text-white">Chrome or Edge</span> on this computer.
      </Step>
      <Step index={2}>
        Click the install icon in the address bar, or the menu →{' '}
        <span className="font-semibold text-white">More tools</span> →{' '}
        <span className="font-semibold text-white">Create shortcut</span> (check “Open as window”).
      </Step>
      <Step index={3}>Launch SkuD Turbo from your apps list and sign in.</Step>
    </ol>
  )
}

export function InstallAppDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm transition-opacity data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <DialogPrimitive.Popup className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111114] p-6 text-white shadow-2xl outline-none animate-in fade-in-0 zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogPrimitive.Title className="text-xl font-extrabold leading-tight">
                  Install SkuD Turbo
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1.5 text-sm leading-relaxed text-white/55">
                  One-time setup — then sign in and trade from your dashboard.
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close
                aria-label="Close install instructions"
                className="-mr-1 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white/65 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>
            <div className="mt-5">
              <InstallGuide />
            </div>
          </DialogPrimitive.Popup>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
