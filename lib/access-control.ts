import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getSupabaseUser } from '@/lib/supabase'

export function sessionIdMatches(provided: string, active: string) {
  const providedBytes = Buffer.from(provided)
  const activeBytes = Buffer.from(active)
  return providedBytes.length === activeBytes.length && timingSafeEqual(providedBytes, activeBytes)
}

export async function requireApprovedUser(request: Request) {
  const accessToken = request.headers.get('x-supabase-access-token') ?? ''
  if (!accessToken) {
    return { error: Response.json({ error: 'Sign in to continue.' }, { status: 401 }) } as const
  }

  let authUser
  try {
    authUser = await getSupabaseUser(accessToken)
  } catch {
    return {
      error: Response.json({ error: 'Authentication is not configured.' }, { status: 503 }),
    } as const
  }
  if (!authUser) {
    return { error: Response.json({ error: 'Your session is invalid or expired.' }, { status: 401 }) } as const
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
          orderBy: { expiresAt: 'desc' },
          take: 1,
        },
      },
    })
    const clientSessionId = request.headers.get('x-session-id') ?? ''
    if (user?.activeSessionId && !sessionIdMatches(clientSessionId, user.activeSessionId)) {
      return {
        error: Response.json(
          { error: 'This account signed in on another device.' },
          { status: 401 },
        ),
      } as const
    }
    const subscription = user?.subscriptions[0]
    if (!user || user.accessStatus !== 'APPROVED' || !subscription) {
      return {
        error: Response.json(
          { error: 'Your account is awaiting mentor approval or its subscription has expired.' },
          { status: 403 },
        ),
      } as const
    }
    return { user, subscription } as const
  } catch {
    return {
      error: Response.json({ error: 'Could not verify your subscription access.' }, { status: 503 }),
    } as const
  }
}
