// Test-user seeder: creates a real Supabase Auth user and grants it
// APPROVED access with an ACTIVE subscription so the full dashboard is visible.
// Idempotent — safe to run repeatedly.
//
// Usage: node --env-file=.env.local scripts/seed-test-user.mjs

import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

const EMAIL = 'testing@gmail.com'
const PASSWORD = 'testing'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const prisma = new PrismaClient()

async function findAuthUserId() {
  let page = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`Could not list auth users: ${error.message}`)
    const found = data.users.find((user) => user.email?.toLowerCase() === EMAIL)
    if (found) return found.id
    if (data.users.length < 200) return null
    page += 1
  }
}

try {
  let authUserId = await findAuthUserId()

  if (authUserId) {
    const { error } = await supabase.auth.admin.updateUserById(authUserId, {
      password: PASSWORD,
      email_confirm: true,
    })
    if (error) throw new Error(`Could not update auth user: ${error.message}`)
    console.log(`Auth user already exists (${authUserId}) — password reset.`)
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    })
    if (error || !data.user) throw new Error(`Could not create auth user: ${error?.message ?? 'no user returned'}`)
    authUserId = data.user.id
    console.log(`Auth user created (${authUserId}).`)
  }

  await prisma.user.upsert({
    where: { id: authUserId },
    create: { id: authUserId, email: EMAIL, accessStatus: 'APPROVED' },
    update: { email: EMAIL, accessStatus: 'APPROVED' },
  })

  const now = new Date()
  const expiresAt = new Date(now)
  expiresAt.setMonth(expiresAt.getMonth() + 12)

  const active = await prisma.subscription.findFirst({
    where: { userId: authUserId, status: 'ACTIVE', expiresAt: { gt: now } },
  })
  if (!active) {
    await prisma.subscription.create({
      data: {
        userId: authUserId,
        status: 'ACTIVE',
        durationMonths: 12,
        startsAt: now,
        expiresAt,
        mentorName: 'Testing',
      },
    })
    console.log('Subscription created (ACTIVE, 12 months).')
  } else {
    console.log('Active subscription already exists — skipped.')
  }

  console.log(`\nDone. Sign in with ${EMAIL} / ${PASSWORD}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
