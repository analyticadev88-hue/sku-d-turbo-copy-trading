import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-guard'

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return jsonError('Invalid request origin.', 403)
  const access = await requireAdmin(request)
  if ('error' in access) return access.error

  let payload: { userId?: unknown; durationMonths?: unknown }
  try {
    payload = await request.json() as typeof payload
  } catch {
    return jsonError('Invalid approval details.', 400)
  }

  const userId = typeof payload.userId === 'string' ? payload.userId : ''
  const durationMonths = Number(payload.durationMonths)
  if (!userId || !Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 12) {
    return jsonError('Choose a user and select 1–12 months.', 400)
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.user.updateMany({
        where: { id: userId, accessStatus: { not: 'REJECTED' } },
        data: { accessStatus: 'APPROVED' },
      })
      if (claimed.count !== 1) throw new Error('User not found or rejected.')

      const now = new Date()
      const activeSubscription = await transaction.subscription.findFirst({
        where: { userId, status: 'ACTIVE', expiresAt: { gt: now } },
        orderBy: { expiresAt: 'desc' },
      })
      const startsAt = activeSubscription?.expiresAt ?? now
      const expiresAt = new Date(startsAt.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000)
      await transaction.subscription.updateMany({
        where: { userId, status: 'ACTIVE', expiresAt: { lte: startsAt } },
        data: { status: 'EXPIRED' },
      })
      await transaction.subscription.create({
        data: { userId, durationMonths, startsAt, expiresAt, mentorName: 'Admin' },
      })
    })

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
    if (!user) return jsonError('User not found or rejected.', 404)
    const subscription = user.subscriptions[0] ?? null
    return Response.json(
      {
        client: {
          id: user.id,
          email: user.email,
          accessStatus: user.accessStatus,
          isAdmin: user.isAdmin,
          subscription: subscription
            ? {
                status: subscription.status,
                expiresAt: subscription.expiresAt.toISOString(),
                mentorName: subscription.mentorName,
              }
            : null,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found or rejected.') {
      return jsonError(error.message, 404)
    }
    return jsonError('Could not approve this account.', 503)
  }
}
