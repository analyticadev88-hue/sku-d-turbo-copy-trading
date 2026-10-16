import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function isMentor(request: Request) {
  const expected = process.env.SKUD_ACCESS_APPROVAL_CODE ?? ''
  const supplied = request.headers.get('x-mentor-setup-code') ?? ''
  const expectedBytes = Buffer.from(expected)
  const suppliedBytes = Buffer.from(supplied)
  return expectedBytes.length > 0 &&
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
}

export async function GET(request: Request) {
  if (!isMentor(request)) return jsonError('Unauthorized.', 401)
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { accessStatus: 'PENDING' },
          {
            accessStatus: 'APPROVED',
            subscriptions: {
              none: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
            },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, createdAt: true },
    })
    return Response.json({ users }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return jsonError('Could not load pending account approvals.', 503)
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return jsonError('Invalid request origin.', 403)
  if (!isMentor(request)) return jsonError('Unauthorized.', 401)

  let payload: { userId?: unknown; mentorName?: unknown; durationMonths?: unknown }
  try {
    payload = await request.json() as typeof payload
  } catch {
    return jsonError('Invalid approval details.', 400)
  }

  const userId = typeof payload.userId === 'string' ? payload.userId : ''
  const mentorName = typeof payload.mentorName === 'string' ? payload.mentorName.trim() : ''
  const durationMonths = Number(payload.durationMonths)
  if (
    !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(userId) ||
    !mentorName ||
    mentorName.length > 80 ||
    !Number.isInteger(durationMonths) ||
    durationMonths < 1 ||
    durationMonths > 12
  ) {
    return jsonError('Choose a user, enter your mentor name, and select 1–12 months.', 400)
  }

  try {
    const approval = await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.user.updateMany({
        where: { id: userId, accessStatus: { not: 'REJECTED' } },
        data: { accessStatus: 'APPROVED' },
      })
      if (claimed.count !== 1) throw new Error('This account cannot be approved.')

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
        data: { userId, durationMonths, startsAt, expiresAt, mentorName },
      })
      return { startsAt, expiresAt }
    })
    return Response.json(
      { approved: true, startsAt: approval.startsAt.toISOString(), expiresAt: approval.expiresAt.toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'This account cannot be approved.') {
      return jsonError(error.message, 404)
    }
    return jsonError('Could not approve this account.', 503)
  }
}
