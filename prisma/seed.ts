import "dotenv/config"

import { db } from "../lib/db"
import { INGREDIENTS } from "./ingredients"

// `lib/env.ts` is server-only and validates far more than this script needs.
// prisma/ sits outside the ESLint block that forbids process.env, so the seed
// reads what it needs directly.
function requiredEnv(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === "") {
    throw new Error(`${name} is not set. See .env.example.`)
  }
  return value
}

// The two fixed users of design document section 6.4. Addresses come from the
// environment, never from source: sign-up is disabled, so whatever is seeded
// here is exactly the set of people who can sign in.
//
// The upsert below keys on the email, so running this again with a different
// address adds a user rather than renaming one. Change the addresses before the
// first seed; afterwards, update the existing rows instead.
//
// `emailVerified` is not decoration. better-auth refuses to link a first OAuth
// account to a local user whose email is unverified — `requireLocalEmailVerified`
// defaults to true — so a seeded user left at the default false can never sign
// in, and the refusal surfaces as "account not linked". The takeover that flag
// guards against needs an attacker able to create an unverified row; sign-up is
// disabled and these two addresses come from the environment, so there is none.
const USERS = [
  { email: requiredEnv("OWNER_EMAIL"), name: "Thomas", emailVerified: true },
  { email: requiredEnv("PARTNER_EMAIL"), name: "Partner", emailVerified: true },
]

async function main() {
  for (const user of USERS) {
    await db.user.upsert({
      where: { email: user.email },
      update: { name: user.name, emailVerified: true },
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
