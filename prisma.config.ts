import "dotenv/config"

import { defineConfig, env } from "prisma/config"

// CLI only. DIRECT_URL because migrations cannot run through a pooler; the
// application uses the pooled DATABASE_URL in lib/db.ts. See
// docs/conventions/data.md.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
})
