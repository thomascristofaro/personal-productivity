import "dotenv/config"

import { db } from "../lib/db"
import { INGREDIENTS } from "./ingredients"

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

  // Upsert on the name, so re-seeding never duplicates and never clobbers an
  // aisle the user has since corrected in the app.
  for (const ingredient of INGREDIENTS) {
    await db.ingredient.upsert({
      where: { name: ingredient.name },
      update: {},
      create: ingredient,
    })
  }

  console.log(
    `Seeded ${USERS.length} users and ${INGREDIENTS.length} ingredients.`
  )
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await db.$disconnect()
    process.exit(1)
  })
