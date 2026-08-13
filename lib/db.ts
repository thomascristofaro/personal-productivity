import "server-only"

import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

import { env } from "@/lib/env"
import { PrismaClient } from "@/lib/generated/prisma/client"

// Prisma 7 throws without an explicit adapter. The generic pg one keeps the
// database swappable; see docs/conventions/data.md.
const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString: env.DATABASE_URL })),
  })

// Without the global, hot reload leaks a connection pool per edit.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
}
