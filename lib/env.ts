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
