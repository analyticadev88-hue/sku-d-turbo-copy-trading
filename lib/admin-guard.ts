import { prisma } from '@/lib/prisma'
import { getSupabaseUser } from '@/lib/supabase'

export async function requireAdmin(request: Request) {
  const accessToken = request.headers.get('x-supabase-access-token') ?? ''
  if (!accessToken) {
    return { error: Response.json({ error: 'Sign in to continue.' }, { status: 401 }) } as const
  }

  let authUser
  try {
    authUser = await getSupabaseUser(accessToken)
  } catch {
    return {
      error: Response.json({ error: 'Authentication is not configured.' }, { status: 503 }),
    } as const
  }
  if (!authUser) {
    return { error: Response.json({ error: 'Your session is invalid or expired.' }, { status: 401 }) } as const
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: authUser.id } })
    if (!user?.isAdmin) {
      return { error: Response.json({ error: 'Admin access required.' }, { status: 403 }) } as const
    }
    return { user } as const
  } catch {
    return {
      error: Response.json({ error: 'Could not verify admin access.' }, { status: 503 }),
    } as const
  }
}
