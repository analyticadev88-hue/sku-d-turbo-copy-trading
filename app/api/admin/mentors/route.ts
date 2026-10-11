import { timingSafeEqual } from 'node:crypto'

const MENTOR_ID_PATTERN = /^[A-Za-z0-9_-]{3,64}$/
const LOGIN_PATTERN = /^\d{4,20}$/

function constantTimeMatch(value: string, expected: string) {
  const actualBytes = Buffer.from(value)
  const expectedBytes = Buffer.from(expected)
  return expectedBytes.length > 0 && actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const setupCode = process.env.JOEMONEY_MENTOR_SETUP_CODE ?? ''
  const suppliedCode = request.headers.get('x-mentor-setup-code') ?? ''
  if (!constantTimeMatch(suppliedCode, setupCode)) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const bridgeUrl = process.env.JOEMONEY_BRIDGE_URL
  const bridgeKey = process.env.JOEMONEY_BRIDGE_KEY
  if (!bridgeUrl || !bridgeKey) {
    return Response.json({ error: 'MT5 bridge configuration is incomplete.' }, { status: 503 })
  }

  let payload: { mentorId?: unknown; mentorName?: unknown; login?: unknown; server?: unknown }
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid mentor details.' }, { status: 400 })
  }

  const mentorId = String(payload.mentorId ?? '').trim()
  const mentorName = String(payload.mentorName ?? '').trim()
  const login = String(payload.login ?? '').trim()
  const server = String(payload.server ?? '').trim()
  if (!MENTOR_ID_PATTERN.test(mentorId) || !mentorName || mentorName.length > 80 ||
      !LOGIN_PATTERN.test(login) || !server || server.length > 128) {
    return Response.json({ error: 'Enter a valid mentor ID, name, MT5 login, and server.' }, { status: 400 })
  }

  let response: Response
  try {
    response = await fetch(`${bridgeUrl.replace(/\/$/, '')}/v1/mentors`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bridgeKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mentor_id: mentorId, mentor_name: mentorName, login, server }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    return Response.json({ error: 'Could not reach the MT5 bridge.' }, { status: 502 })
  }

  const result = await response.json().catch(() => null) as { error?: string; mentor_token?: string } | null
  if (!response.ok || !result?.mentor_token) {
    return Response.json({ error: result?.error ?? 'Could not register mentor.' }, { status: response.status || 502 })
  }

  return Response.json({ mentorId, mentorName, login, server, mentorToken: result.mentor_token }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}