import { prisma } from '@/lib/prisma'
import { sessionIdMatches } from '@/lib/access-control'
import { getSupabaseUser } from '@/lib/supabase'

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function getAuthUser(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return null
  return getSupabaseUser(token)
}

async function accessState(userId: string, clientSessionId = '') {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscriptions: {
        where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
        orderBy: { expiresAt: 'desc' },
        take: 1,
      },
    },
  })
  if (!user) return { status: 'pending' as const }
  if (user.activeSessionId && !sessionIdMatches(clientSessionId, user.activeSessionId)) {
    return { status: 'superseded' as const }
  }

  const subscription = user.subscriptions[0]
  if (user.accessStatus === 'APPROVED' && subscription) {
    return {
      status: 'approved' as const,
      expiresAt: subscription.expiresAt.toISOString(),
    }
  }
  if (user.accessStatus === 'REJECTED') return { status: 'rejected' as const }
  if (user.accessStatus === 'APPROVED') return { status: 'expired' as const }
  return { status: 'pending' as const }
}

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return jsonError('Sign in with a valid Supabase account.', 401)

    // No payment step: a first visit registers the account as PENDING and the
    // admin or a mentor approves it.
    if (!authUser.email) return jsonError('Sign in with a valid email account.', 401)
    await prisma.user.upsert({
      where: { id: authUser.id },
      create: { id: authUser.id, email: authUser.email },
      update: { email: authUser.email },
    })

    const state = await accessState(authUser.id, request.headers.get('x-session-id') ?? '')
    return Response.json(state, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return jsonError('Could not verify your account access.', 503)
  }
}
