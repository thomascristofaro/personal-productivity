import "server-only"

import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"

import { db } from "@/lib/db"
import { env } from "@/lib/env"

const DAY = 60 * 60 * 24

export const auth = betterAuth({
  secret: env.AUTH_SECRET,
  // Explicit, not derived from the request: an origin guessed from proxy
  // headers is exactly what breaks an OAuth callback, and this has to match the
  // redirect URI registered with Google.
  baseURL: env.APP_URL,
  database: prismaAdapter(db, { provider: "postgresql" }),

  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // The entire allowlist. An existing user may authenticate; nobody new is
      // ever created, so only the two seeded addresses can get in. Removing
      // this opens the app to every Google account there is.
      disableSignUp: true,
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      // Google verifies the addresses it asserts, which is what makes linking a
      // first sign-in to the seeded user by email safe.
      trustedProviders: ["google"],
    },
  },

  session: {
    // Ninety days. Re-login friction threatens success criterion 3 directly.
    expiresIn: DAY * 90,
    updateAge: DAY,
  },

  rateLimit: {
    enabled: true,
    // Serverless functions share no memory, so the counter is persisted.
    storage: "database",
  },

  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
    },
  },

  // Must stay last: it is what lets a server action set the cookie.
  plugins: [nextCookies()],
})
