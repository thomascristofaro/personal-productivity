import { describe, expect, it } from "vitest"

import { EnvSchema } from "@/lib/env"

const valid = {
  DATABASE_URL: "postgresql://user:pw@ep-x.eu-central-1.aws.neon.tech/db",
  DIRECT_URL: "postgresql://user:pw@ep-x.eu-central-1.aws.neon.tech/db",
  APP_URL: "https://menu.example.com",
  AUTH_SECRET: "3PMGhXcCBOD-0mn3Xh6h2rGV0lQnbnRLtQ4hVLLQ5Ks",
  GOOGLE_CLIENT_ID: "1234.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "GOCSPX-not-a-real-secret",
  OWNER_EMAIL: "owner@gmail.com",
  PARTNER_EMAIL: "partner@gmail.com",
}

const without = (key: keyof typeof valid) => {
  const rest: Record<string, string> = { ...valid }
  delete rest[key]
  return rest
}

describe("EnvSchema", () => {
  it("accepts a complete environment", () => {
    expect(EnvSchema.parse(valid)).toMatchObject(valid)
  })

  it("defaults NODE_ENV to development", () => {
    expect(EnvSchema.parse(valid).NODE_ENV).toBe("development")
  })

  it("rejects a missing database URL rather than starting without one", () => {
    expect(() => EnvSchema.parse({ DIRECT_URL: valid.DIRECT_URL })).toThrow()
  })

  it("rejects a host:port pair that is not a connection string", () => {
    expect(() =>
      EnvSchema.parse({ ...valid, DATABASE_URL: "localhost:5432" })
    ).toThrow()
  })

  it("rejects a connection string for the wrong database", () => {
    expect(() =>
      EnvSchema.parse({ ...valid, DATABASE_URL: "mysql://user:pw@host/db" })
    ).toThrow()
  })

  it("rejects a missing Google client id rather than starting without one", () => {
    expect(() => EnvSchema.parse(without("GOOGLE_CLIENT_ID"))).toThrow()
  })

  it("rejects a seeded address that is not an email", () => {
    expect(() => EnvSchema.parse({ ...valid, OWNER_EMAIL: "owner" })).toThrow()
  })

  it("rejects an auth secret too short to sign anything safely", () => {
    expect(() => EnvSchema.parse({ ...valid, AUTH_SECRET: "short" })).toThrow()
  })

  // A trailing slash produces callback URLs with a double slash, which Google
  // then refuses as not matching the registered redirect URI.
  it("rejects an app URL with a trailing slash", () => {
    expect(() =>
      EnvSchema.parse({ ...valid, APP_URL: "https://menu.example.com/" })
    ).toThrow()
  })
})
