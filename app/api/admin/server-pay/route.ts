import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-guard'

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function serverPayConfig() {
  const threshold = Number.parseInt(process.env.SKUD_SERVER_PAY_THRESHOLD ?? '', 10)
  const pricePerStudent = Number.parseFloat(process.env.SKUD_SERVER_PAY_PRICE_USD ?? '')
  return {
    threshold: Number.isFinite(threshold) && threshold > 0 ? threshold : 30,
    pricePerStudent: Number.isFinite(pricePerStudent) && pricePerStudent > 0 ? pricePerStudent : 13,
    whopUrl: process.env.WHOP_PAYMENT_URL ?? '',
  }
}

// Students are covered by the mentor's one-off server payment, not by their
// own checkout. Every `threshold` newly approved (still unpaid) students the
// admin app raises a Whop payment modal for that batch.
export async function GET(request: Request) {
  const access = await requireAdmin(request)
  if ('error' in access) return access.error

  const { threshold, pricePerStudent, whopUrl } = serverPayConfig()

  try {
    const unpaidCount = await prisma.user.count({
      where: { isAdmin: false, mentorId: null, accessStatus: 'APPROVED', oneOffServerPay: false },
    })
    const batchSize = Math.min(threshold, unpaidCount)
    return Response.json(
      {
        unpaidCount,
        threshold,
        pricePerStudent,
        whopUrl,
        batchSize,
        totalDue: batchSize * pricePerStudent,
        showModal: unpaidCount >= threshold,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return jsonError('Could not count unpaid students.', 503)
  }
}

// Marks the oldest `threshold` unpaid approved students as covered by the
// mentor's Whop payment. Called from the modal once the batch is paid.
export async function POST(request: Request) {
  const access = await requireAdmin(request)
  if ('error' in access) return access.error

  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return jsonError('Invalid request origin.', 403)
  }

  const { threshold } = serverPayConfig()

  try {
    const batch = await prisma.user.findMany({
      where: { isAdmin: false, mentorId: null, accessStatus: 'APPROVED', oneOffServerPay: false },
      orderBy: { createdAt: 'asc' },
      take: threshold,
      select: { id: true },
    })
    const marked = await prisma.user.updateMany({
      where: { id: { in: batch.map((user) => user.id) } },
      data: { oneOffServerPay: true },
    })
    const remainingUnpaid = await prisma.user.count({
      where: { isAdmin: false, mentorId: null, accessStatus: 'APPROVED', oneOffServerPay: false },
    })
    return Response.json(
      { marked: marked.count, remainingUnpaid },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return jsonError('Could not mark the batch as paid.', 503)
  }
}
