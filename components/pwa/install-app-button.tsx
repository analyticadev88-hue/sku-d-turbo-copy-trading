'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { InstallAppDialog } from './install-app-dialog'

export function InstallAppButton({
  className,
  label = 'Install the app',
}: {
  className?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={className}
      >
        {label}
        <Download className="size-4" aria-hidden="true" />
      </button>
      <InstallAppDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
