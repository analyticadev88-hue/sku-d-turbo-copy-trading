import { requireMentor } from '@/lib/mentor-guard'

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(request: Request) {
  const access = await requireMentor(request)
  if ('error' in access) return access.error

  const bridgeUrl = process.env.SKUD_BRIDGE_URL
  const bridgeKey = process.env.SKUD_BRIDGE_KEY
  if (!bridgeUrl || !bridgeKey) {
    return jsonError('MT5 bridge configuration is incomplete.', 503)
  }

  let bridgeResponse: Response
  try {
    bridgeResponse = await fetch(
      `${bridgeUrl.replace(/\/$/, '')}/v1/mentors/${encodeURIComponent(access.mentorId)}`,
      {
        headers: { Authorization: `Bearer ${bridgeKey}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      },
    )
  } catch {
    return jsonError('Could not reach the MT5 bridge.', 502)
  }

  const body = await bridgeResponse.json().catch(() => null)
  return Response.json(body ?? { error: 'Invalid response from the MT5 bridge.' }, {
    status: bridgeResponse.status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
