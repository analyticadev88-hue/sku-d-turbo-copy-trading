import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'

type WhopCheckoutConfiguration = {
  purchase_url?: unknown
}

function getWhopErrorMessage(value: unknown, apiKey: string): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return

  const record = value as Record<string, unknown>
  const error = record.error
  const candidates = [
    record.message,
    record.detail,
    typeof error === 'string' ? error : undefined,
    error && typeof error === 'object' && !Array.isArray(error)
      ? (error as Record<string, unknown>).message
      : undefined,
    error && typeof error === 'object' && !Array.isArray(error)
      ? (error as Record<string, unknown>).detail
      : undefined,
  ]
  const message = candidates.find((candidate): candidate is string => typeof candidate === 'string')
  if (!message) return

  return message.replaceAll(apiKey, '[redacted]').slice(0, 400)
}

function isWhopCheckoutUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'whop.com' || url.hostname.endsWith('.whop.com'))
    )
  } catch {
    return false
  }
}

async function markOrderFailed(orderId: string) {
  await prisma.paymentOrder.updateMany({
    where: { id: orderId, status: 'PENDING' },
    data: { status: 'FAILED' },
  })
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const apiKey = process.env.WHOP_API_KEY
  const planId = process.env.WHOP_PLAN_ID
  const webhookSecret = process.env.WHOP_WEBHOOK_SECRET
  if (!apiKey || !planId?.startsWith('plan_') || !webhookSecret) {
    return Response.json(
      { error: 'Whop production checkout is not configured. Add the production API key, plan ID, and webhook secret.' },
      { status: 503 },
    )
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return Response.json(
      { error: 'Supabase account access is not configured. Complete authentication setup before checkout.' },
      { status: 503 },
    )
  }

  let appUrl: URL
  try {
    appUrl = new URL(process.env.APP_URL ?? new URL(request.url).origin)
  } catch {
    return Response.json({ error: 'APP_URL must be a valid absolute URL.' }, { status: 503 })
  }
  if (appUrl.protocol !== 'https:') {
    return Response.json(
      { error: 'APP_URL must be your public HTTPS domain for production checkout.' },
      { status: 503 },
    )
  }

  const orderId = `skud-${randomUUID()}`
  const returnUrl = new URL('/dashboard', appUrl)
  returnUrl.searchParams.set('checkout', 'returned')
  returnUrl.searchParams.set('order_id', orderId)

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
    providerResponse = await fetch('https://api.whop.com/api/v1/checkout_configurations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Api-Version-Date': '2026-10-29-8',
        'Content-Type': 'application/json',
        'Idempotency-Key': orderId,
      },
      body: JSON.stringify({
        variant_id: planId,
        metadata: { order_id: orderId },
        redirect_url: returnUrl.toString(),
        payment_method_configuration: {
          enabled: ['card'],
          include_platform_defaults: false,
        },
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    try {
      await markOrderFailed(orderId)
    } catch {
      return Response.json({ error: 'Could not record the failed checkout attempt.' }, { status: 503 })
    }
    return Response.json({ error: 'Could not reach Whop. Please try again.' }, { status: 502 })
  }

  const responseBody = await providerResponse.text()
  let responseData: unknown
  try {
    responseData = JSON.parse(responseBody)
  } catch {
    responseData = null
  }

  if (!providerResponse.ok) {
    try {
      await markOrderFailed(orderId)
    } catch {
      return Response.json({ error: 'Could not record the failed checkout attempt.' }, { status: 503 })
    }
    const detail = getWhopErrorMessage(responseData, apiKey)
    return Response.json(
      {
        error: `Whop rejected checkout creation (HTTP ${providerResponse.status}).${detail ? ` ${detail}` : ' Check that Vercel has the production API key, that the plan belongs to that Whop account, and that the key can create checkout configurations.'}`,
      },
      { status: 502 },
    )
  }

  const configuration = responseData as WhopCheckoutConfiguration | null
  if (!isWhopCheckoutUrl(configuration?.purchase_url)) {
    try {
      await markOrderFailed(orderId)
    } catch {
      return Response.json({ error: 'Could not record the failed checkout attempt.' }, { status: 503 })
    }
    return Response.json(
      { error: 'Whop returned a successful response without a valid hosted checkout URL.' },
      { status: 502 },
    )
  }

  return Response.json({
    checkoutUrl: configuration.purchase_url,
    orderId,
  })
}
