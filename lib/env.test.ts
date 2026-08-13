import { describe, expect, it } from "vitest"

import { EnvSchema } from "@/lib/env"

const valid = {
  DATABASE_URL: "postgresql://user:pw@ep-x.eu-central-1.aws.neon.tech/db",
  DIRECT_URL: "postgresql://user:pw@ep-x.eu-central-1.aws.neon.tech/db",
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
})
