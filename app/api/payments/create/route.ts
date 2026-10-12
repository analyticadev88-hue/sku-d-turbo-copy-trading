import { randomUUID } from 'node:crypto'

const PRICE_AMOUNT = 13
const PRICE_CURRENCY = 'usd'
const NOWPAYMENTS_SANDBOX_URL = 'https://api-sandbox.nowpayments.io/v1'
const NOWPAYMENTS_LIVE_URL = 'https://api.nowpayments.io/v1'

type NowPaymentsInvoice = {
  invoice_url?: string
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

  const isSandbox = process.env.NOWPAYMENTS_ENV !== 'production'
  const apiBase = isSandbox ? NOWPAYMENTS_SANDBOX_URL : NOWPAYMENTS_LIVE_URL
  const appBase = process.env.APP_URL ?? new URL(request.url).origin
  const orderId = `skud-${randomUUID()}`

  let providerResponse: Response
  try {
    providerResponse = await fetch(`${apiBase}/invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        price_amount: PRICE_AMOUNT,
        price_currency: PRICE_CURRENCY,
        order_id: orderId,
        order_description: 'SkuD Turbo MT5 app and Germany server setup',
        success_url: new URL('/dashboard?checkout=returned', appBase).toString(),
        cancel_url: new URL('/dashboard?checkout=cancelled', appBase).toString(),
      }),
      cache: 'no-store',
    })
  } catch {
    return Response.json({ error: 'Could not reach NOWPayments. Please try again.' }, { status: 502 })
  }

  const invoice = (await providerResponse.json().catch(() => null)) as NowPaymentsInvoice | null
  if (!providerResponse.ok || !invoice?.invoice_url) {
    return Response.json(
      { error: 'NOWPayments could not create a test invoice. Check the sandbox API key and try again.' },
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

  return Response.json({
    invoiceUrl: invoiceUrl.toString(),
    orderId,
    mode: isSandbox ? 'sandbox' : 'production',
  })
}