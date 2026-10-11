import { createHmac, timingSafeEqual } from 'node:crypto'

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

export async function GET(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const bridgeUrl = process.env.JOEMONEY_BRIDGE_URL
  const bridgeKey = process.env.JOEMONEY_BRIDGE_KEY
  if (!bridgeUrl || !bridgeKey) {
    return Response.json({ error: 'MT5 bridge configuration is incomplete.' }, { status: 503 })
  }

  const url = new URL(request.url)
  const login = url.searchParams.get('login')?.trim() ?? ''
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!/^\d{4,20}$/.test(login) || !tokenMatches(login, token, bridgeKey)) {
    return Response.json({ error: 'Status token is invalid or expired.' }, { status: 401 })
  }

  let bridgeResponse: Response
  try {
    bridgeResponse = await fetch(
      `${bridgeUrl.replace(/\/$/, '')}/v1/status?login=${encodeURIComponent(login)}`,
      {
        headers: { Authorization: `Bearer ${bridgeKey}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
      },
    )
  } catch {
    return Response.json({ error: 'Could not reach the MT5 bridge.' }, { status: 502 })
  }

  const body = await bridgeResponse.json().catch(() => null)
  return Response.json(body ?? { error: 'Invalid response from the MT5 bridge.' }, {
    status: bridgeResponse.status,
    headers: { 'Cache-Control': 'no-store' },
  })
}