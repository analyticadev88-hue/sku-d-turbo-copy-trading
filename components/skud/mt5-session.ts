'use client'

export type StoredMt5Account = { login: string; server: string; statusToken: string }

const STORAGE_KEY = 'skud-mt5-account'
const LEGACY_SESSION_KEY = 'skud-mt5-account'

function parseAccount(raw: string | null): StoredMt5Account | null {
  if (!raw) return null
  try {
    const account = JSON.parse(raw) as Partial<StoredMt5Account>
    if (!account.login || !account.server || !account.statusToken) return null
    return { login: account.login, server: account.server, statusToken: account.statusToken }
  } catch {
    return null
  }
}

export function loadStoredAccount(): StoredMt5Account | null {
  if (typeof window === 'undefined') return null
  const stored = parseAccount(window.localStorage.getItem(STORAGE_KEY))
  if (stored) return stored
  // One-time migration from the old sessionStorage-only session.
  const legacy = parseAccount(window.sessionStorage.getItem(LEGACY_SESSION_KEY))
  if (legacy) {
    saveStoredAccount(legacy)
    window.sessionStorage.removeItem(LEGACY_SESSION_KEY)
    return legacy
  }
  return null
}

export function saveStoredAccount(account: StoredMt5Account) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(account))
  window.sessionStorage.removeItem(LEGACY_SESSION_KEY)
}

export function clearStoredAccount() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
  window.sessionStorage.removeItem(LEGACY_SESSION_KEY)
}
