import type { Metadata } from 'next'
import { AccessGate } from '@/components/skud/access-gate'

export const metadata: Metadata = {
  title: 'Dashboard — SkuD Turbo',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string | string[]; preview?: string | string[]; login?: string | string[] }>
}) {
  const { checkout, preview, login } = await searchParams

  return (
    <AccessGate
      preview={preview === '1'}
      checkout={typeof checkout === 'string' ? checkout : undefined}
      login={login === '1'}
    />
  )
}
