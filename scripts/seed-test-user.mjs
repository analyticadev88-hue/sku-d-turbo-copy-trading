// Test-user seeder: creates real Supabase Auth users for testing.
// - testing@gmail.com: normal approved user with an ACTIVE subscription.
// - skudmasima@test.com: admin user (isAdmin) — no payment/subscription needed.
// Idempotent — safe to run repeatedly.
//
// Usage: node --env-file=.env.local scripts/seed-test-user.mjs

import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

const TEST_USER = { email: 'testing@gmail.com', password: 'testing', admin: false }
const ADMIN_USER = { email: 'skudmasima@test.com', password: 'masima123', admin: true }
const MENTOR_USER = { email: 'skudmentor@test.com', password: 'mentor123', mentorId: 'mentor-skud-01' }

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

async function findAuthUserId(email) {
  let page = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`Could not list auth users: ${error.message}`)
    const found = data.users.find((user) => user.email?.toLowerCase() === email)
    if (found) return found.id
    if (data.users.length < 200) return null
    page += 1
  }
}

async function upsertAuthUser({ email, password }) {
  const existingId = await findAuthUserId(email)
  if (existingId) {
    const { error } = await supabase.auth.admin.updateUserById(existingId, {
      password,
      email_confirm: true,
    })
    if (error) throw new Error(`Could not update auth user ${email}: ${error.message}`)
    console.log(`Auth user already exists (${email}) — password reset.`)
    return existingId
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Could not create auth user ${email}: ${error?.message ?? 'no user returned'}`)
  console.log(`Auth user created (${email}, ${data.user.id}).`)
  return data.user.id
}

async function seedTestUser() {
  const authUserId = await upsertAuthUser(TEST_USER)

  await prisma.user.upsert({
    where: { id: authUserId },
    create: { id: authUserId, email: TEST_USER.email, accessStatus: 'APPROVED' },
    update: { email: TEST_USER.email, accessStatus: 'APPROVED' },
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
}

async function seedAdminUser() {
  const authUserId = await upsertAuthUser(ADMIN_USER)

  await prisma.user.upsert({
    where: { id: authUserId },
    create: { id: authUserId, email: ADMIN_USER.email, isAdmin: true },
    update: { email: ADMIN_USER.email, isAdmin: true },
  })
  console.log('Admin flag set in database (no subscription required).')
}

async function seedMentorUser() {
  const authUserId = await upsertAuthUser(MENTOR_USER)

  await prisma.user.upsert({
    where: { id: authUserId },
    create: { id: authUserId, email: MENTOR_USER.email, mentorId: MENTOR_USER.mentorId },
    update: { email: MENTOR_USER.email, mentorId: MENTOR_USER.mentorId },
  })
  console.log(`Mentor portal user linked to bridge mentor '${MENTOR_USER.mentorId}'.`)
}

try {
  await seedTestUser()
  await seedAdminUser()
  await seedMentorUser()
  console.log(`\nDone.`)
  console.log(`  Test user: ${TEST_USER.email} / ${TEST_USER.password}`)
  console.log(`  Admin:     ${ADMIN_USER.email} / ${ADMIN_USER.password}`)
  console.log(`  Mentor:    ${MENTOR_USER.email} / ${MENTOR_USER.password}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
