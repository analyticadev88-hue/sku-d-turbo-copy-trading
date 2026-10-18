import type { Metadata } from 'next'
import { AdminApp } from '@/components/skud/admin-app'

export const metadata: Metadata = {
  title: 'Dashboard — SkuD Turbo',
}

export default function DashboardPage() {
  return <AdminApp />
}
