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
  if (!user) return { status: 'payment_required' as const, isAdmin: false, mentorId: null }
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
    const state = await accessState(authUser.id)
    return Response.json(state, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return jsonError('Could not verify your account access.', 503)
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return jsonError('Invalid request origin.', 403)
  }

  let authUser
  try {
    authUser = await getAuthUser(request)
  } catch {
    return jsonError('Authentication is not configured.', 503)
  }
  if (!authUser || !authUser.email) return jsonError('Sign in with a valid email account.', 401)

  let payload: { orderId?: unknown }
  try {
    payload = await request.json() as { orderId?: unknown }
  } catch {
    return jsonError('Invalid payment reference.', 400)
  }

  const orderId = typeof payload.orderId === 'string' ? payload.orderId : ''
  if (!/^skud-[0-9a-f-]{36}$/i.test(orderId)) {
    return jsonError('Complete the setup payment before creating an account.', 400)
  }

  try {
    const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
    if (!order || order.status !== 'PAID') {
      return jsonError('Payment has not been confirmed yet. Please wait for confirmation.', 402)
    }
    if (order.userId && order.userId !== authUser.id) {
      return jsonError('This payment has already been linked to another account.', 409)
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.user.upsert({
        where: { id: authUser.id },
        create: { id: authUser.id, email: authUser.email! },
        update: { email: authUser.email! },
      })
      const claimed = await transaction.paymentOrder.updateMany({
        where: { id: orderId, status: 'PAID', OR: [{ userId: null }, { userId: authUser.id }] },
        data: { userId: authUser.id },
      })
      if (claimed.count !== 1) throw new Error('Payment is already linked to another account.')
    })

    const state = await accessState(authUser.id)
    return Response.json(
      state.status === 'expired' ? { status: 'pending' } : state,
      {
      headers: { 'Cache-Control': 'no-store' },
      },
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('already linked')) {
      return jsonError(error.message, 409)
    }
    return jsonError('Could not register your account. Please try again.', 503)
  }
}
