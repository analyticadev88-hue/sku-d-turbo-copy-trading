import { createHmac } from 'node:crypto'
import { requireApprovedUser } from '@/lib/access-control'
import { DERIV_SERVERS } from '@/lib/mt5-servers'

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return jsonError('Invalid request origin.', 403)
  }
  const access = await requireApprovedUser(request)
  if ('error' in access) return access.error
  if (process.env.SKUD_ALLOW_DEMO_STUDENT_ENROLLMENT !== 'true') {
    return jsonError('Student enrollment is disabled on this deployment.', 503)
  }

  const bridgeUrl = process.env.SKUD_BRIDGE_URL
  const bridgeKey = process.env.SKUD_BRIDGE_KEY
  const mentorId = process.env.SKUD_DEFAULT_MENTOR_ID
  if (!bridgeUrl || !bridgeKey || !mentorId) {
    console.error('[mt5 enroll] bridge configuration is incomplete')
    return jsonError('MT5 connection is temporarily unavailable. Please try again in a moment.', 503)
  }

  let payload: { login?: unknown; password?: unknown; server?: unknown }
  try {
    payload = await request.json()
  } catch {
    return jsonError('Invalid account details.', 400)
  }

  const login = String(payload.login ?? '').trim()
  const password = String(payload.password ?? '')
  const server = String(payload.server ?? '')
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
      // Always enroll as a student: an account previously registered as the
      // mentor must be demoted back to student when it re-enrolls here.
      body: JSON.stringify({ login, password, server, mentor_id: mentorId, role: 'student' }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    console.error('[mt5 enroll] could not reach the bridge for login', login)
    return jsonError('We could not connect your MT5 account right now. Please try again in a moment or contact your mentor.', 502)
  }

  const bridgeBody = await bridgeResponse.json().catch(() => null) as
    | { error?: string; launched?: boolean }
    | null
  if (!bridgeResponse.ok) {
    console.error('[mt5 enroll] bridge rejected login', login, bridgeResponse.status, JSON.stringify(bridgeBody))
    return jsonError('We could not connect your MT5 account right now. Please try again in a moment or contact your mentor.', bridgeResponse.status)
  }
  if (!bridgeBody?.launched) {
    console.error('[mt5 enroll] bridge could not launch terminal for login', login, JSON.stringify(bridgeBody))
    return jsonError('We could not connect your MT5 account right now. Please try again in a moment or contact your mentor.', 502)
  }

  const expires = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
  const statusSignature = createHmac('sha256', bridgeKey)
    .update(`${login}:${expires}`)
    .digest('base64url')

  return Response.json(
    { login, server, statusToken: `${expires}.${statusSignature}`, state: 'provisioning' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}