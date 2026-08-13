import "dotenv/config"

import { db } from "../lib/db"

// The two fixed users of design document section 6.4. Change these to the real
// addresses before the first run; the app has no registration flow.
const USERS = [
  { email: "owner@example.invalid", name: "Thomas" },
  { email: "partner@example.invalid", name: "Partner" },
]

async function main() {
  for (const user of USERS) {
    await db.user.upsert({
      where: { email: user.email },
      update: { name: user.name },
      create: user,
    })
  }

  console.log(`Seeded ${USERS.length} users.`)
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await db.$disconnect()
    process.exit(1)
  })
