import { Webhook } from 'standardwebhooks'
import { prisma } from '@/lib/prisma'

type WhopWebhookEvent = {
  type: unknown
  data?: unknown
}

type WhopPayment = {
  id?: unknown
  metadata?: unknown
  plan?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export async function POST(request: Request) {
  const secret = process.env.WHOP_WEBHOOK_SECRET
  const planId = process.env.WHOP_PLAN_ID
  if (!secret || !planId) {
    return Response.json({ error: 'Whop payment notifications are not configured.' }, { status: 503 })
  }

  let event: WhopWebhookEvent
  try {
    // Whop signs with the literal secret; standardwebhooks base64-decodes keys.
    const verifier = new Webhook(Buffer.from(secret, 'utf8').toString('base64'))
    event = verifier.verify(await request.text(), Object.fromEntries(request.headers)) as WhopWebhookEvent
  } catch {
    return Response.json({ error: 'Invalid Whop webhook signature.' }, { status: 401 })
  }

  if (event.type !== 'payment.succeeded' && event.type !== 'payment.failed') {
    return Response.json({ received: true })
  }
  if (!isRecord(event.data)) {
    return Response.json({ error: 'Invalid Whop payment event.' }, { status: 400 })
  }

  const payment = event.data as WhopPayment
  const metadata = isRecord(payment.metadata) ? payment.metadata : null
  const plan = isRecord(payment.plan) ? payment.plan : null
  const orderId = typeof metadata?.order_id === 'string' ? metadata.order_id : ''
  const paymentId = typeof payment.id === 'string' ? payment.id : ''
  if (
    !/^skud-[0-9a-f-]{36}$/i.test(orderId) ||
    !paymentId.startsWith('pay_') ||
    plan?.id !== planId
  ) {
    return Response.json({ received: true })
  }

  try {
    await prisma.paymentOrder.updateMany({
      where: {
        id: orderId,
        status: event.type === 'payment.succeeded' ? { in: ['PENDING', 'FAILED'] } : 'PENDING',
      },
      data: {
        status: event.type === 'payment.succeeded' ? 'PAID' : 'FAILED',
        invoiceId: paymentId,
      },
    })
    return Response.json({ received: true })
  } catch {
    return Response.json({ error: 'Could not record payment status.' }, { status: 503 })
  }
}
