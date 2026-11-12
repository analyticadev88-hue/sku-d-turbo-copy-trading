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

  let payload: { userId?: unknown }
  try {
    payload = await request.json() as typeof payload
  } catch {
    return jsonError('Invalid request.', 400)
  }

  const userId = typeof payload.userId === 'string' ? payload.userId : ''
  if (!userId) return jsonError('Choose a user.', 400)

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return jsonError('User not found.', 404)
    if (user.isAdmin || user.mentorId) {
      return jsonError('Only client accounts can be deleted.', 403)
    }

    // Subscriptions cascade with the user; payment orders are unlinked.
    await prisma.user.delete({ where: { id: userId } })
    return Response.json(
      { deleted: true },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return jsonError('Could not delete this account.', 503)
  }
}
