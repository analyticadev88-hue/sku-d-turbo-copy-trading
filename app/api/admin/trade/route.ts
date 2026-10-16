import { randomUUID } from 'node:crypto'
import { requireAdmin } from '@/lib/admin-guard'

type BridgeAccount = { login?: unknown; server?: unknown; is_active?: unknown }

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function fetchBridgeAccounts(): Promise<{ accounts: BridgeAccount[] } | { error: string }> {
  const bridgeUrl = process.env.SKUD_BRIDGE_URL
  const bridgeKey = process.env.SKUD_BRIDGE_KEY
  if (!bridgeUrl || !bridgeKey) {
    return { error: 'MT5 bridge configuration is incomplete.' }
  }

  let bridgeResponse: Response
  try {
    bridgeResponse = await fetch(`${bridgeUrl.replace(/\/$/, '')}/v1/accounts`, {
      headers: { Authorization: `Bearer ${bridgeKey}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    return { error: 'Could not reach the MT5 bridge.' }
  }

  if (!bridgeResponse.ok) {
    const body = await bridgeResponse.json().catch(() => null) as { error?: string } | null
    return { error: body?.error ?? `The MT5 bridge returned status ${bridgeResponse.status}.` }
  }

  const body = await bridgeResponse.json().catch(() => null)
  if (!Array.isArray(body)) return { error: 'Invalid response from the MT5 bridge.' }
  return { accounts: body as BridgeAccount[] }
}

export async function GET(request: Request) {
  const access = await requireAdmin(request)
  if ('error' in access) return access.error

  const result = await fetchBridgeAccounts()
  if ('error' in result) return jsonError(result.error, 502)
  return Response.json({ accounts: result.accounts }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return jsonError('Invalid request origin.', 403)
  const access = await requireAdmin(request)
  if ('error' in access) return access.error

  let payload: { symbol?: unknown; side?: unknown; volume?: unknown }
  try {
    payload = await request.json() as typeof payload
  } catch {
    return jsonError('Invalid trade details.', 400)
  }

  const symbol = typeof payload.symbol === 'string' ? payload.symbol.trim().toUpperCase() : ''
  const side = payload.side
  const volume = Number(payload.volume)
  if (!symbol || (side !== 'BUY' && side !== 'SELL') || !Number.isFinite(volume) || volume < 0.01 || volume > 100) {
    return jsonError('Enter a symbol, choose BUY or SELL, and a volume between 0.01 and 100.', 400)
  }

  const bridgeUrl = process.env.SKUD_BRIDGE_URL
  const bridgeKey = process.env.SKUD_BRIDGE_KEY
  if (!bridgeUrl || !bridgeKey) {
    return jsonError('MT5 bridge configuration is incomplete.', 502)
  }

  const result = await fetchBridgeAccounts()
  if ('error' in result) return jsonError(result.error, 502)
  const activeAccounts = result.accounts.filter((account) => Boolean(account.is_active))
  if (activeAccounts.length === 0) {
    return jsonError('No active client accounts on the bridge.', 422)
  }

  const results = await Promise.all(activeAccounts.map(async (account) => {
    const login = typeof account.login === 'string' || typeof account.login === 'number'
      ? String(account.login)
      : ''
    try {
      const orderResponse = await fetch(`${bridgeUrl.replace(/\/$/, '')}/v1/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bridgeKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify({
          login,
          orders: [{
            symbol,
            order_type: side === 'BUY' ? 'MARKET_BUY' : 'MARKET_SELL',
            volume,
            tp_enabled: false,
            sl_enabled: false,
          }],
        }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!orderResponse.ok) {
        const body = await orderResponse.json().catch(() => null) as { error?: string } | null
        return { login, ok: false, error: body?.error ?? `The bridge returned status ${orderResponse.status}.` }
      }
      const body = await orderResponse.json().catch(() => null) as { orders?: { status?: string }[] } | null
      return { login, ok: true, status: body?.orders?.[0]?.status ?? 'queued' }
    } catch (error) {
      return { login, ok: false, error: error instanceof Error ? error.message : 'Could not reach the MT5 bridge.' }
    }
  }))

  return Response.json(
    { results, count: results.length },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
