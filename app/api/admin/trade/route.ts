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

  const body = await bridgeResponse.json().catch(() => null) as { accounts?: unknown } | null
  if (!Array.isArray(body?.accounts)) return { error: 'Invalid response from the MT5 bridge.' }
  return { accounts: body.accounts as BridgeAccount[] }
}

export async function GET(request: Request) {
  const access = await requireAdmin(request)
  if ('error' in access) return access.error

  const bridgeUrl = process.env.SKUD_BRIDGE_URL
  const bridgeKey = process.env.SKUD_BRIDGE_KEY
  if (!bridgeUrl || !bridgeKey) {
    return jsonError('MT5 bridge configuration is incomplete.', 502)
  }

  const url = new URL(request.url)
  const pricesLogin = url.searchParams.get('prices')?.trim() ?? ''
  if (pricesLogin) {
    if (!/^\d{4,20}$/.test(pricesLogin)) {
      return jsonError('Enter a valid MT5 login.', 400)
    }
    let pricesResponse: Response
    try {
      pricesResponse = await fetch(
        `${bridgeUrl.replace(/\/$/, '')}/v1/prices?login=${encodeURIComponent(pricesLogin)}`,
        {
          headers: { Authorization: `Bearer ${bridgeKey}` },
          cache: 'no-store',
          signal: AbortSignal.timeout(10_000),
        },
      )
    } catch {
      return jsonError('Could not reach the MT5 bridge.', 502)
    }
    const pricesBody = await pricesResponse.json().catch(() => null)
    return Response.json(pricesBody ?? { error: 'Invalid response from the MT5 bridge.' }, {
      status: pricesResponse.status,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const result = await fetchBridgeAccounts()
  if ('error' in result) return jsonError(result.error, 502)
  return Response.json({ accounts: result.accounts }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return jsonError('Invalid request origin.', 403)
  const access = await requireAdmin(request)
  if ('error' in access) return access.error

  let payload: {
    symbol?: unknown
    side?: unknown
    volume?: unknown
    mirrorLogin?: unknown
    tpEnabled?: unknown
    tpDistance?: unknown
    slEnabled?: unknown
    slDistance?: unknown
  }
  try {
    payload = await request.json() as typeof payload
  } catch {
    return jsonError('Invalid trade details.', 400)
  }

  const symbol = typeof payload.symbol === 'string' ? payload.symbol.trim() : ''
  const side = payload.side
  const volume = Number(payload.volume)
  const tpEnabled = payload.tpEnabled === true
  const tpDistance = Number(payload.tpDistance ?? 0)
  const slEnabled = payload.slEnabled === true
  const slDistance = Number(payload.slDistance ?? 0)
  if (!symbol || (side !== 'BUY' && side !== 'SELL') || !Number.isFinite(volume) || volume < 0.01 || volume > 100) {
    return jsonError('Enter a symbol, choose BUY or SELL, and a volume between 0.01 and 100.', 400)
  }
  if ((payload.tpEnabled !== undefined && typeof payload.tpEnabled !== 'boolean') ||
      !Number.isFinite(tpDistance) || tpDistance < 0 || (tpEnabled && tpDistance === 0) ||
      (payload.slEnabled !== undefined && typeof payload.slEnabled !== 'boolean') ||
      !Number.isFinite(slDistance) || slDistance < 0 || (slEnabled && slDistance === 0)) {
    return jsonError('Enabled take profit and stop loss require positive price distances.', 400)
  }
  const mirrorLogin = typeof payload.mirrorLogin === 'string' ? payload.mirrorLogin.trim() : ''

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

  const broadcastAccounts = activeAccounts.filter((account) => String(account.login ?? '') !== mirrorLogin)
  const order = {
    symbol,
    order_type: side === 'BUY' ? 'MARKET_BUY' : 'MARKET_SELL',
    volume,
    tp_enabled: tpEnabled,
    tp_distance: tpDistance,
    sl_enabled: slEnabled,
    sl_distance: slDistance,
  }
  const results = await Promise.all(broadcastAccounts.map(async (account) => {
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
          orders: [order],
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

  if (mirrorLogin) {
    const mirrorActive = activeAccounts.some((account) =>
      String(account.login ?? '') === mirrorLogin && Boolean(account.is_active))
    if (mirrorActive) {
      try {
        const orderResponse = await fetch(`${bridgeUrl.replace(/\/$/, '')}/v1/orders`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bridgeKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': randomUUID(),
          },
          body: JSON.stringify({
            login: mirrorLogin,
            orders: [order],
          }),
          signal: AbortSignal.timeout(10_000),
        })
        if (!orderResponse.ok) {
          const body = await orderResponse.json().catch(() => null) as { error?: string } | null
          results.push({ login: mirrorLogin, ok: false, error: body?.error ?? `The bridge returned status ${orderResponse.status}.` })
        } else {
          const body = await orderResponse.json().catch(() => null) as { orders?: { status?: string }[] } | null
          results.push({ login: mirrorLogin, ok: true, status: body?.orders?.[0]?.status ?? 'queued' })
        }
      } catch (error) {
        results.push({ login: mirrorLogin, ok: false, error: error instanceof Error ? error.message : 'Could not reach the MT5 bridge.' })
      }
    }
  }

  return Response.json(
    { results, count: results.length },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
