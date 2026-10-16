import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get('order_id') ?? ''
  if (!/^skud-[0-9a-f-]{36}$/i.test(orderId)) {
    return Response.json({ error: 'Invalid payment reference.' }, { status: 400 })
  }

  try {
    const order = await prisma.paymentOrder.findUnique({
      where: { id: orderId },
      select: { status: true },
    })
    if (!order) return Response.json({ error: 'Payment reference was not found.' }, { status: 404 })
    return Response.json({ status: order.status }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Could not check payment status.' }, { status: 503 })
  }
}
