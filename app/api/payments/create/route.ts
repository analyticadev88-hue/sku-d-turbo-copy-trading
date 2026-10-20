import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { SETUP_PRICE_AMOUNT, SETUP_PRICE_CURRENCY } from '@/lib/payment-config'

const NOWPAYMENTS_SANDBOX_URL = 'https://api-sandbox.nowpayments.io/v1'
const NOWPAYMENTS_LIVE_URL = 'https://api.nowpayments.io/v1'

type NowPaymentsInvoice = {
  invoice_url?: string
  id?: string
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const apiKey = process.env.NOWPAYMENTS_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: 'Checkout is not configured. Add a NOWPayments sandbox API key to the server environment.' },
      { status: 503 },
    )
  }
  if (!process.env.NOWPAYMENTS_IPN_SECRET) {
    return Response.json(
      { error: 'Payment verification is not configured. Add the NOWPayments IPN secret before opening checkout.' },
      { status: 503 },
    )
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return Response.json(
      { error: 'Supabase account access is not configured. Complete authentication setup before checkout.' },
      { status: 503 },
    )
  }

  const isSandbox = process.env.NOWPAYMENTS_ENV !== 'production'
  const apiBase = isSandbox ? NOWPAYMENTS_SANDBOX_URL : NOWPAYMENTS_LIVE_URL
  const appBase = process.env.APP_URL ?? new URL(request.url).origin
  const orderId = `skud-${randomUUID()}`

  try {
    await prisma.paymentOrder.create({ data: { id: orderId } })
  } catch {
    return Response.json(
      { error: 'Payment storage is unavailable. Please try again later.' },
      { status: 503 },
    )
  }

  let providerResponse: Response
  try {
    providerResponse = await fetch(`${apiBase}/invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        price_amount: SETUP_PRICE_AMOUNT,
        price_currency: SETUP_PRICE_CURRENCY,
        order_id: orderId,
        order_description: 'SkuD Turbo EA hosting and Germany MT5 server setup',
        ipn_callback_url: new URL('/api/webhooks/nowpayments', appBase).toString(),
        success_url: new URL(
          `/dashboard?checkout=returned&order_id=${encodeURIComponent(orderId)}`,
          appBase,
        ).toString(),
        cancel_url: new URL(
          `/dashboard?checkout=cancelled&order_id=${encodeURIComponent(orderId)}`,
          appBase,
        ).toString(),
      }),
      cache: 'no-store',
    })
  } catch {
    await prisma.paymentOrder.update({
      where: { id: orderId },
      data: { status: 'FAILED' },
    })
    return Response.json({ error: 'Could not reach NOWPayments. Please try again.' }, { status: 502 })
  }

  const invoice = (await providerResponse.json().catch(() => null)) as NowPaymentsInvoice | null
  if (!providerResponse.ok || !invoice?.invoice_url) {
    await prisma.paymentOrder.update({
      where: { id: orderId },
      data: { status: 'FAILED' },
    })
    return Response.json(
      { error: 'NOWPayments could not create an invoice. Check the API key and try again.' },
      { status: 502 },
    )
  }

  let invoiceUrl: URL
  try {
    invoiceUrl = new URL(invoice.invoice_url)
  } catch {
    return Response.json({ error: 'NOWPayments returned an invalid checkout link.' }, { status: 502 })
  }

  const trustedHost =
    invoiceUrl.hostname === 'nowpayments.io' || invoiceUrl.hostname.endsWith('.nowpayments.io')
  if (invoiceUrl.protocol !== 'https:' || !trustedHost) {
    return Response.json({ error: 'NOWPayments returned an unexpected checkout link.' }, { status: 502 })
  }

  if (invoice.id) {
    await prisma.paymentOrder.update({
      where: { id: orderId },
      data: { invoiceId: String(invoice.id) },
    }).catch(() => {})
  }

  return Response.json({
    invoiceUrl: invoiceUrl.toString(),
    orderId,
    mode: isSandbox ? 'sandbox' : 'production',
  })
}