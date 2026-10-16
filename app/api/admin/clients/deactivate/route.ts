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
    const result = await prisma.subscription.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'REVOKED' },
    })
    return Response.json(
      { revoked: result.count },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return jsonError('Could not deactivate this subscription.', 503)
  }
}
