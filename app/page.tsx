import type { Metadata } from 'next'
import { AdminEntry } from '@/components/skud/admin-entry'

export const metadata: Metadata = {
  title: 'SkuD Turbo Admin',
}

export default function HomePage() {
  return <AdminEntry />
}
