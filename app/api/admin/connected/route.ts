import { requireAdmin } from '@/lib/admin-guard'
import { prisma } from '@/lib/prisma'

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(request: Request) {
  const access = await requireAdmin(request)
  if ('error' in access) return access.error

  const bridgeUrl = process.env.SKUD_BRIDGE_URL
  const bridgeKey = process.env.SKUD_BRIDGE_KEY
  if (!bridgeUrl || !bridgeKey) {
    return jsonError('MT5 bridge configuration is incomplete.', 503)
  }

  let bridgeResponse: Response
  try {
    bridgeResponse = await fetch(`${bridgeUrl.replace(/\/$/, '')}/v1/accounts`, {
      headers: { Authorization: `Bearer ${bridgeKey}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    return jsonError('Could not reach the MT5 bridge.', 502)
  }

  const bridgeBody = await bridgeResponse.json().catch(() => null) as
    | { accounts?: unknown }
    | null
  if (!bridgeResponse.ok) {
    return jsonError('The MT5 bridge could not load connected accounts.', bridgeResponse.status)
  }
  if (!Array.isArray(bridgeBody?.accounts)) {
    return jsonError('Invalid response from the MT5 bridge.', 502)
  }

  try {
    const linkedAccounts = await prisma.mt5Account.findMany({
      include: { user: { select: { email: true } } },
    })
    const linksByLogin = new Map(linkedAccounts.map((account) => [account.login, account]))
    const seenLogins = new Set<string>()
    const accounts: Record<string, unknown>[] = bridgeBody.accounts
      .filter((account): account is Record<string, unknown> =>
        Boolean(account) && typeof account === 'object' &&
        String((account as Record<string, unknown>).role ?? 'student') === 'student',
      )
      .map((account) => {
        const login = String(account.login ?? '')
        seenLogins.add(login)
        const linked = linksByLogin.get(login)
        const provisioningError = linked?.provisioningError ?? null
        return {
          login,
          server: String(account.server ?? ''),
          role: 'student',
          is_active: Boolean(account.is_active),
          terminal_running: Boolean(account.terminal_running),
          ea_connected: Boolean(account.ea_connected),
          state: String(account.state ?? 'starting'),
          trading_allowed: account.trading_allowed ?? null,
          copying_ready: account.copying_ready ?? null,
          margin_mode: String(account.margin_mode ?? ''),
          reported_server: String(account.reported_server ?? ''),
          last_seen: typeof account.last_seen === 'number' ? account.last_seen : null,
          balance: typeof account.balance === 'number' ? account.balance : null,
          balance_updated_at:
            typeof account.balance_updated_at === 'number' ? account.balance_updated_at : null,
          currency: String(account.currency ?? ''),
          message: String(account.message ?? ''),
          clientEmail: linked?.user.email ?? null,
          provisioningError,
        }
      })

    for (const linked of linkedAccounts) {
      if (seenLogins.has(linked.login)) continue
      accounts.push({
        login: linked.login,
        server: linked.server,
        role: 'student',
        is_active: false,
        terminal_running: false,
        ea_connected: false,
        state: linked.provisioningError ? 'provisioning_error' : 'not_registered',
        last_seen: null,
        balance: null,
        balance_updated_at: null,
        currency: '',
        message: linked.provisioningError
          ?? 'This client account is linked in SkuD but is not registered on the MT5 bridge.',
        clientEmail: linked.user.email,
        provisioningError: linked.provisioningError,
      })
    }

    return Response.json({ accounts }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[admin connected] could not load client MT5 account mappings', error)
    return jsonError('Could not load client account ownership details.', 503)
  }
}
