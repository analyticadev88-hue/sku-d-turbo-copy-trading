import { requireAdmin } from '@/lib/admin-guard'
import { DERIV_SERVERS } from '@/lib/mt5-servers'

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function bridgeConfig() {
  const bridgeUrl = process.env.SKUD_BRIDGE_URL
  const bridgeKey = process.env.SKUD_BRIDGE_KEY
  if (!bridgeUrl || !bridgeKey) return null
  return { base: bridgeUrl.replace(/\/$/, ''), key: bridgeKey }
}

export async function GET(request: Request) {
  const access = await requireAdmin(request)
  if ('error' in access) return access.error

  const config = bridgeConfig()
  if (!config) return jsonError('MT5 bridge configuration is incomplete.', 503)

  const url = new URL(request.url)
  const login = url.searchParams.get('login')?.trim() ?? ''
  if (!/^\d{4,20}$/.test(login)) {
    return jsonError('Enter a valid MT5 login.', 400)
  }

  let response: Response
  try {
    response = await fetch(`${config.base}/v1/status?login=${encodeURIComponent(login)}`, {
      headers: { Authorization: `Bearer ${config.key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    return jsonError('Could not reach the MT5 bridge.', 502)
  }

  const body = await response.json().catch(() => null)
  return Response.json(body ?? { error: 'Invalid response from the MT5 bridge.' }, {
    status: response.status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return jsonError('Invalid request origin.', 403)
  }
  const access = await requireAdmin(request)
  if ('error' in access) return access.error

  const config = bridgeConfig()
  if (!config) return jsonError('MT5 bridge configuration is incomplete.', 503)

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

  let response: Response
  try {
    response = await fetch(`${config.base}/v1/accounts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ login, password, server, mentor_id: '', role: 'student' }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    return jsonError('Could not reach the MT5 bridge. Please try again.', 502)
  }

  const body = await response.json().catch(() => null) as
    | { error?: string; launched?: boolean }
    | null
  if (!response.ok) {
    return jsonError(body?.error ?? 'The MT5 bridge could not register this account.', response.status || 502)
  }
  if (!body?.launched) {
    return jsonError('The MT5 terminal could not be started. Check the bridge server.', 502)
  }

  return Response.json({ login, server, state: 'provisioning' }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
