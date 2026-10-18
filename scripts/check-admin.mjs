// Read-only: list users and their admin/mentor flags.
// Usage: node --env-file=.env.local scripts/check-admin.mjs [email]
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const filter = process.argv[2]?.toLowerCase()

try {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, isAdmin: true, mentorId: true, accessStatus: true },
    orderBy: { createdAt: 'asc' },
  })
  const rows = filter ? users.filter((u) => u.email?.toLowerCase().includes(filter)) : users
  if (rows.length === 0) {
    console.log(filter ? `No user matching "${filter}".` : 'No users in the database.')
    console.log(`Total users: ${users.length}`)
  } else {
    for (const u of rows) {
      console.log(`${u.email} | isAdmin=${u.isAdmin} | mentorId=${u.mentorId ?? '-'} | access=${u.accessStatus}`)
    }
  }
} finally {
  await prisma.$disconnect()
}
