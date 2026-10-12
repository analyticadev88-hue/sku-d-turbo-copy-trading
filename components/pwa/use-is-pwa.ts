'use client'

import { useEffect, useState } from 'react'

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * null while detecting (first client render), then true/false.
 * Re-evaluates if the display mode changes (e.g. right after install).
 */
export function useIsPwa(): boolean | null {
  const [isPwa, setIsPwa] = useState<boolean | null>(null)

  useEffect(() => {
    const query = window.matchMedia('(display-mode: standalone)')
    const update = () => setIsPwa(detectStandalone())
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return isPwa
}
