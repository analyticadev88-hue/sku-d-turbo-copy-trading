import { createHmac, timingSafeEqual } from 'node:crypto'
import { requireApprovedUser } from '@/lib/access-control'

function tokenMatches(login: string, token: string, bridgeKey: string) {
  const [expiresText, signature, extra] = token.split('.')
  const expires = Number(expiresText)
  if (extra !== undefined || !Number.isInteger(expires) || expires < Date.now() / 1000 || !signature) {
    return false
  }
  const expected = createHmac('sha256', bridgeKey)
    .update(`${login}:${expires}`)
    .digest('base64url')
  const actualBytes = Buffer.from(signature)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ login: string }> },
) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  const access = await requireApprovedUser(request)
  if ('error' in access) return access.error

  const bridgeUrl = process.env.SKUD_BRIDGE_URL
  const bridgeKey = process.env.SKUD_BRIDGE_KEY
  if (!bridgeUrl || !bridgeKey) {
    console.error('[mt5 disconnect] bridge configuration is incomplete')
    return Response.json({ error: 'MT5 connection is temporarily unavailable. Please try again in a moment.' }, { status: 503 })
  }

  const { login } = await params
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!/^\d{4,20}$/.test(login) || !tokenMatches(login, token, bridgeKey)) {
    return Response.json({ error: 'Status token is invalid or expired.' }, { status: 401 })
  }

  let bridgeResponse: Response
  try {
    bridgeResponse = await fetch(
      `${bridgeUrl.replace(/\/$/, '')}/v1/accounts/${encodeURIComponent(login)}/deactivate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${bridgeKey}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(25_000),
      },
    )
  } catch {
    console.error('[mt5 disconnect] could not reach the bridge for login', login)
    return Response.json({ error: 'We could not disconnect your MT5 account right now. Please try again in a moment.' }, { status: 502 })
  }

  const body = await bridgeResponse.json().catch(() => null)
  if (!bridgeResponse.ok) {
    console.error('[mt5 disconnect] bridge error for login', login, bridgeResponse.status, JSON.stringify(body))
    return Response.json({ error: 'We could not disconnect your MT5 account right now. Please try again in a moment.' }, {
      status: bridgeResponse.status,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
  return Response.json(body ?? { error: 'We could not disconnect your MT5 account right now. Please try again in a moment.' }, {
    status: bridgeResponse.status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
