import type { Metadata } from 'next'
import { AccessStart } from '@/components/skud/access-start'
import { CheckoutReturn } from '@/components/skud/checkout-return'
import { Dashboard } from '@/components/skud/dashboard'

export const metadata: Metadata = {
  title: 'Dashboard — SkuD Turbo',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string | string[]; preview?: string | string[] }>
}) {
  const { checkout, preview } = await searchParams

  if (preview === '1') {
    return <Dashboard preview />
  }

  if (checkout === 'returned') {
    return <CheckoutReturn />
  }

  return <AccessStart />
}
