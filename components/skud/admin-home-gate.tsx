'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserSupabase } from '@/lib/supabase'

type GateState = 'checking' | 'public' | 'error'

export function AdminHomeGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<GateState>('checking')

  useEffect(() => {
    let active = true

    async function checkAdmin() {
      try {
        const { data } = await getBrowserSupabase().auth.getSession()
        const token = data.session?.access_token
        if (!token) {
          if (active) setState('public')
          return
        }

        const response = await fetch('/api/access', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        if (!response.ok) throw new Error('Could not verify the signed-in account.')

        const result = await response.json() as { isAdmin?: boolean }
        if (!active) return
        if (result.isAdmin === true) {
          router.replace('/dashboard')
          return
        }
        setState('public')
      } catch {
        if (active) setState('error')
      }
    }

    void checkAdmin()
    return () => { active = false }
  }, [router])

  if (state === 'public') return children

  return (
    <main className="grid min-h-dvh place-items-center bg-[#0b0b0d] px-5 text-white">
      {state === 'checking' ? (
        <p role="status" className="text-sm text-white/60">Checking account…</p>
      ) : (
        <div className="flex flex-col items-center gap-4 text-center">
          <p role="alert" className="text-sm text-white/70">Could not verify your account.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-md border border-white/15 px-4 text-sm font-bold text-white transition-colors hover:border-white/35"
          >
            Try again
          </button>
        </div>
      )}
    </main>
  )
}