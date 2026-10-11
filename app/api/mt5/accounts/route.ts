import { createHmac, timingSafeEqual } from 'node:crypto'

const DERIV_SERVERS = [
  'Deriv-Demo',
  'DerivBVI-Demo',
  'DerivSVG-Demo',
  'DerivSVG-Server',
  'DerivSVG-Server-02',
  'DerivSVG-Server-03',
  'DerivBVI-Server',
  'DerivBVI-Server-02',
  'DerivBVI-Server-03',
]

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function constantTimeMatch(value: string, expected: string) {
  const actualBytes = Buffer.from(value)
  const expectedBytes = Buffer.from(expected)
  return expectedBytes.length > 0 && actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return jsonError('Invalid request origin.', 403)
  }
  if (process.env.SKUD_ALLOW_DEMO_STUDENT_ENROLLMENT !== 'true') {
    return jsonError('Student enrollment is disabled on this deployment.', 503)
  }

  const bridgeUrl = process.env.SKUD_BRIDGE_URL
  const bridgeKey = process.env.SKUD_BRIDGE_KEY
  const mentorId = process.env.SKUD_DEFAULT_MENTOR_ID
  if (!bridgeUrl || !bridgeKey || !mentorId) {
    return jsonError('MT5 bridge configuration is incomplete.', 503)
  }

  const enrollmentCode = process.env.SKUD_STUDENT_ENROLLMENT_CODE ?? ''
  if (!enrollmentCode) {
    return jsonError('Demo enrollment code is not configured.', 503)
  }

  let payload: { login?: unknown; password?: unknown; server?: unknown; enrollmentCode?: unknown }
  try {
    payload = await request.json()
  } catch {
    return jsonError('Invalid account details.', 400)
  }

  const login = String(payload.login ?? '').trim()
  const password = String(payload.password ?? '')
  const server = String(payload.server ?? '')
  const suppliedCode = String(payload.enrollmentCode ?? '')
  if (!constantTimeMatch(suppliedCode, enrollmentCode)) {
    return jsonError('Invalid demo enrollment code.', 401)
  }
  if (!/^\d{4,20}$/.test(login) || password.length < 1 || password.length > 128) {
    return jsonError('Enter a valid MT5 login and trading password.', 400)
  }
  if (!DERIV_SERVERS.includes(server)) {
    return jsonError('Choose a supported Deriv MT5 server.', 400)
  }
  if (!server.includes('Demo') && process.env.SKUD_ALLOW_LIVE_STUDENT_ACCOUNTS !== 'true') {
    return jsonError('Live accounts are disabled. Use an MT5 demo account for this test.', 403)
  }

  let bridgeResponse: Response
  try {
    bridgeResponse = await fetch(`${bridgeUrl.replace(/\/$/, '')}/v1/accounts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bridgeKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ login, password, server, mentor_id: mentorId }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    return jsonError('Could not reach the MT5 bridge. Please try again.', 502)
  }

  const bridgeBody = await bridgeResponse.json().catch(() => null) as
    | { error?: string; launched?: boolean }
    | null
  if (!bridgeResponse.ok) {
    return jsonError(bridgeBody?.error ?? 'The MT5 bridge could not register this account.', bridgeResponse.status)
  }
  if (!bridgeBody?.launched) {
    return jsonError('The MT5 terminal could not be started. Check the bridge server.', 502)
  }

  const expires = Math.floor(Date.now() / 1000) + 15 * 60
  const statusSignature = createHmac('sha256', bridgeKey)
    .update(`${login}:${expires}`)
    .digest('base64url')

  return Response.json(
    { login, server, statusToken: `${expires}.${statusSignature}`, state: 'provisioning' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}