import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-guard'

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(request: Request) {
  const access = await requireAdmin(request)
  if ('error' in access) return access.error

  const url = new URL(request.url)
  const q = url.searchParams.get('q')?.trim() ?? ''

  try {
    const users = await prisma.user.findMany({
      where: q ? { email: { contains: q, mode: 'insensitive' } } : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        subscriptions: {
          where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
          orderBy: { expiresAt: 'desc' },
          take: 1,
        },
      },
    })
    const clients = users.map((user) => {
      const subscription = user.subscriptions[0] ?? null
      return {
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
      }
    })
    return Response.json({ clients }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return jsonError('Could not load clients.', 503)
  }
}
