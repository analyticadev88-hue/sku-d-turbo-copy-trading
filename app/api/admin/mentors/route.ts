import { requireAdmin } from '@/lib/admin-guard'

const MENTOR_ID_PATTERN = /^[A-Za-z0-9_-]{3,64}$/
const LOGIN_PATTERN = /^\d{4,20}$/

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
  const id = url.searchParams.get('id')?.trim() ?? ''
  const path = id ? `/v1/mentors/${encodeURIComponent(id)}` : '/v1/mentors'

  let response: Response
  try {
    response = await fetch(`${config.base}${path}`, {
      headers: { Authorization: `Bearer ${config.key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
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

  let payload: { mentorId?: unknown; mentorName?: unknown; login?: unknown; server?: unknown; password?: unknown }
  try {
    payload = await request.json()
  } catch {
    return jsonError('Invalid mentor details.', 400)
  }

  const mentorId = String(payload.mentorId ?? '').trim()
  const mentorName = String(payload.mentorName ?? '').trim()
  const login = String(payload.login ?? '').trim()
  const server = String(payload.server ?? '').trim()
  const password = String(payload.password ?? '')
  if (!MENTOR_ID_PATTERN.test(mentorId) || !mentorName || mentorName.length > 80 ||
      !LOGIN_PATTERN.test(login) || !server || server.length > 128) {
    return jsonError('Enter a valid mentor ID, name, MT5 login, and server.', 400)
  }
  if (password && password.length < 6) {
    return jsonError('The MT5 password must be at least 6 characters.', 400)
  }

  let response: Response
  try {
    response = await fetch(`${config.base}/v1/mentors`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mentor_id: mentorId,
        mentor_name: mentorName,
        login,
        server,
        ...(password ? { password } : {}),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    return jsonError('Could not reach the MT5 bridge.', 502)
  }

  const result = await response.json().catch(() => null) as
    | { error?: string; terminal?: string }
    | null
  if (!response.ok || !result) {
    return jsonError(result?.error ?? 'Could not register mentor.', response.status || 502)
  }

  return Response.json({
    mentorId,
    mentorName,
    login,
    server,
    terminal: result.terminal ?? '',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
