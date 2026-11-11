import { prisma } from '@/lib/prisma'
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

async function accessState(userId: string) {
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
  if (!user) return { status: 'pending' as const, isAdmin: false, mentorId: null }
  if (user.isAdmin) return { status: 'approved' as const, isAdmin: true, mentorId: null }
  if (user.mentorId) return { status: 'approved' as const, isAdmin: false, mentorId: user.mentorId }

  const subscription = user.subscriptions[0]
  if (user.accessStatus === 'APPROVED' && subscription) {
    return {
      status: 'approved' as const,
      isAdmin: false,
      mentorId: null,
      expiresAt: subscription.expiresAt.toISOString(),
    }
  }
  if (user.accessStatus === 'REJECTED') return { status: 'rejected' as const, isAdmin: false, mentorId: null }
  if (user.accessStatus === 'APPROVED') return { status: 'expired' as const, isAdmin: false, mentorId: null }
  return { status: 'pending' as const, isAdmin: false, mentorId: null }
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

    const state = await accessState(authUser.id)
    return Response.json(state, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return jsonError('Could not verify your account access.', 503)
  }
}
