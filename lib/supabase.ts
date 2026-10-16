import { createClient } from '@supabase/supabase-js'

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  }
  return { url, key }
}

let browserClient: ReturnType<typeof createClient> | undefined

export function getBrowserSupabase() {
  if (!browserClient) {
    const { url, key } = getSupabaseConfig()
    browserClient = createClient(url, key)
  }
  return browserClient
}

export async function getSupabaseUser(accessToken: string) {
  const { url, key } = getSupabaseConfig()
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error) return null
  return data.user
}
