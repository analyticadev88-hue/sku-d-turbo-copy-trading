import { prisma } from '@/lib/prisma'
import { getSupabaseUser } from '@/lib/supabase'

export async function requireMentor(request: Request) {
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
    if (!user?.mentorId) {
      return { error: Response.json({ error: 'Mentor access required.' }, { status: 403 }) } as const
    }
    return { mentorId: user.mentorId } as const
  } catch {
    return {
      error: Response.json({ error: 'Could not verify mentor access.' }, { status: 503 }),
    } as const
  }
}
