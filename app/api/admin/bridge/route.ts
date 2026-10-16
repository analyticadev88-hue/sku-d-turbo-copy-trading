import { requireAdmin } from '@/lib/admin-guard'

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
  const path = url.searchParams.get('path')?.trim() ?? ''
  if (path !== 'accounts') {
    return jsonError('Unsupported bridge path.', 400)
  }

  let response: Response
  try {
    response = await fetch(`${config.base}/v1/accounts`, {
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

  let payload: { action?: unknown; login?: unknown; mentorId?: unknown; volumeMultiplier?: unknown }
  try {
    payload = await request.json()
  } catch {
    return jsonError('Invalid assignment details.', 400)
  }

  if (payload.action !== 'assign') {
    return jsonError('Unsupported bridge action.', 400)
  }
  const login = String(payload.login ?? '').trim()
  const mentorId = String(payload.mentorId ?? '').trim()
  const volumeMultiplier = Number(payload.volumeMultiplier ?? 1)
  if (!/^\d{4,20}$/.test(login)) {
    return jsonError('Enter a valid MT5 login.', 400)
  }
  if (!/^[A-Za-z0-9_-]{0,64}$/.test(mentorId)) {
    return jsonError('Enter a valid mentor ID.', 400)
  }
  if (!Number.isFinite(volumeMultiplier) || volumeMultiplier < 0.01 || volumeMultiplier > 100) {
    return jsonError('Enter a volume multiplier between 0.01 and 100.', 400)
  }

  let response: Response
  try {
    response = await fetch(`${config.base}/v1/accounts/${encodeURIComponent(login)}/mentor`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mentor_id: mentorId,
        volume_multiplier: volumeMultiplier,
      }),
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
