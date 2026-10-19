'use client'

const SESSION_KEY = 'skud-active-session'

export function loadClientSessionId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(SESSION_KEY)
}

export function saveClientSessionId(sessionId: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SESSION_KEY, sessionId)
}

export function clearClientSessionId() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SESSION_KEY)
}
