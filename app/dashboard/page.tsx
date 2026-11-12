import type { Metadata } from 'next'
import { AccessGate } from '@/components/skud/access-gate'

export const metadata: Metadata = {
  title: 'Dashboard — SkuD Turbo',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string | string[]; login?: string | string[] }>
}) {
  const { preview, login } = await searchParams

  return (
    <AccessGate
      preview={preview === '1'}
      login={login === '1'}
    />
  )
}
