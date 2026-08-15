import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` throws when imported outside a React Server Component build.
      "server-only": fileURLToPath(
        new URL("./test/stubs/server-only.ts", import.meta.url)
      ),
    },
  },
  test: {
    environment: "node",
    include: ["{app,components,hooks,lib}/**/*.test.{ts,tsx}"],
    // Only so modules that validate their environment at import time can load.
    // None of these reaches a network: no test signs in, and no test connects.
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      DIRECT_URL: "postgresql://test:test@localhost:5432/test",
      AUTH_SECRET: "test-secret-long-enough-to-satisfy-the-schema",
      GOOGLE_CLIENT_ID: "test.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "test",
      OWNER_EMAIL: "owner@example.invalid",
      PARTNER_EMAIL: "partner@example.invalid",
    },
  },
})
