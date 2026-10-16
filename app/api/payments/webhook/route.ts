import { createHmac, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { SETUP_PRICE_AMOUNT, SETUP_PRICE_CURRENCY } from '@/lib/payment-config'

type PaymentNotification = {
  order_id?: unknown
  payment_status?: unknown
  price_amount?: unknown
  price_currency?: unknown
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(
        ([key, entry]) => [key, sortObject(entry)],
      ),
    )
  }
  return value
}

function signatureMatches(payload: unknown, signature: string, secret: string) {
  if (!/^[a-f0-9]{128}$/i.test(signature)) return false
  const expected = createHmac('sha512', secret)
    .update(JSON.stringify(sortObject(payload)))
    .digest('hex')
  const actualBytes = Buffer.from(signature, 'hex')
  const expectedBytes = Buffer.from(expected, 'hex')
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

export async function POST(request: Request) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET
  if (!secret) {
    return Response.json({ error: 'Payment notifications are not configured.' }, { status: 503 })
  }

  let payload: PaymentNotification
  try {
    payload = await request.json() as PaymentNotification
  } catch {
    return Response.json({ error: 'Invalid payment notification.' }, { status: 400 })
  }

  const signature = request.headers.get('x-nowpayments-sig') ?? ''
  if (!signatureMatches(payload, signature, secret)) {
    return Response.json({ error: 'Invalid payment notification signature.' }, { status: 401 })
  }

  const orderId = typeof payload.order_id === 'string' ? payload.order_id : ''
  const paymentStatus = typeof payload.payment_status === 'string' ? payload.payment_status : ''
  if (!/^skud-[0-9a-f-]{36}$/i.test(orderId)) {
    return Response.json({ error: 'Unknown payment reference.' }, { status: 400 })
  }

  const matchesInvoicePrice =
    Number(payload.price_amount) === SETUP_PRICE_AMOUNT &&
    typeof payload.price_currency === 'string' &&
    payload.price_currency.toLowerCase() === SETUP_PRICE_CURRENCY
  const status = paymentStatus === 'finished'
    ? matchesInvoicePrice ? 'PAID' : 'FAILED'
    : ['failed', 'expired', 'refunded'].includes(paymentStatus)
      ? 'FAILED'
      : null
  if (!status) return Response.json({ received: true })

  try {
    const updated = await prisma.paymentOrder.updateMany({
      where: { id: orderId, status: 'PENDING' },
      data: { status },
    })
    if (updated.count === 0) {
      const order = await prisma.paymentOrder.findUnique({
        where: { id: orderId },
        select: { status: true },
      })
      if (!order) return Response.json({ error: 'Payment reference was not found.' }, { status: 404 })
    }
    return Response.json({ received: true })
  } catch {
    return Response.json({ error: 'Could not record payment status.' }, { status: 503 })
  }
}
