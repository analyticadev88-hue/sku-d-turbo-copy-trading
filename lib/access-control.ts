import { prisma } from '@/lib/prisma'
import { getSupabaseUser } from '@/lib/supabase'

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
    const subscription = user?.subscriptions[0]
    // Staff (admins and mentors) never pay: they always have access even
    // without a subscription row.
    const isStaff = Boolean(user?.isAdmin || user?.mentorId)
    if (!user || user.accessStatus !== 'APPROVED' || (!subscription && !isStaff)) {
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
