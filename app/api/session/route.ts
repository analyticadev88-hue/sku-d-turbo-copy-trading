import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getSupabaseUser } from '@/lib/supabase'

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

// Mints the single active session for this account. The next login on any
// device overwrites it, which instantly invalidates every other device.
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return jsonError('Sign in with a valid Supabase account.', 401)

  let authUser
  try {
    authUser = await getSupabaseUser(token)
  } catch {
    return jsonError('Authentication is not configured.', 503)
  }
  if (!authUser?.email) return jsonError('Sign in with a valid email account.', 401)

  const sessionId = randomUUID()
  try {
    await prisma.user.upsert({
      where: { id: authUser.id },
      create: { id: authUser.id, email: authUser.email, activeSessionId: sessionId },
      update: { activeSessionId: sessionId },
    })
  } catch {
    return jsonError('Could not register this device session.', 503)
  }

  return Response.json({ sessionId }, { headers: { 'Cache-Control': 'no-store' } })
}
