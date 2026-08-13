import "dotenv/config"

import { defineConfig, env } from "prisma/config"

// CLI only. DIRECT_URL because migrations cannot run through a pooler; the
// application uses the pooled DATABASE_URL in lib/db.ts. See
// docs/conventions/data.md.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // --conditions=react-server resolves the `server-only` guard in lib/db.ts to
    // an empty module, so the domain layer is reachable from a plain script.
    seed: "node --conditions=react-server --import tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
})
