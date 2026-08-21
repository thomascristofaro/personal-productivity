import "server-only"

import { z } from "zod"

// `z.url()` accepts "localhost:5432", reading "localhost" as the scheme.
const postgresUrl = z
  .string()
  .regex(/^postgres(ql)?:\/\/.+/, "must be a postgres:// connection string")

// Add a variable here when the code that consumes it lands, not before.
// `.env.example` documents the full set.
export const EnvSchema = z.object({
  DATABASE_URL: postgresUrl,
  DIRECT_URL: postgresUrl,
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  // The origin this app is served from, without a trailing slash. Deriving it
  // from the incoming request instead leaves OAuth callbacks depending on
  // whatever proxy headers arrive, which is the one thing sign-in cannot
  // afford. It must match the redirect URI registered with Google.
  APP_URL: z.url().refine((value) => !value.endsWith("/"), {
    message: "must not end with a slash",
  }),
  // 32 random bytes are 43 characters in base64url; anything shorter than the
  // bytes themselves is not a key.
  AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  // The two seeded users of design document section 6.4, read from the
  // environment so real addresses never enter the repository. Sign-up is
  // disabled, so this pair is exactly the set of people who can sign in.
  OWNER_EMAIL: z.email(),
  PARTNER_EMAIL: z.email(),
  // Google AI Studio, not the Cloud Agent Platform: express-mode keys are not
  // accepted by @ai-sdk/google. The SDK looks for GOOGLE_GENERATIVE_AI_API_KEY
  // by itself, so llm.ts passes this one in explicitly.
  GOOGLE_AI_API_KEY: z.string().min(1),
  // Design document 2026-08-21 section 3 chose gemini-3.7-flash. It lives here
  // so the next model is an environment change, not a deploy.
  GEMINI_MODEL: z.string().min(1).default("gemini-3.7-flash"),
})

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  const missing = parsed.error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n")

  throw new Error(
    `Invalid environment variables:\n${missing}\n\nSee .env.example.`
  )
}

export const env = parsed.data
