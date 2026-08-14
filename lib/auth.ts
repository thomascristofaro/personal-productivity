import "server-only"

import { db } from "@/lib/db"
import { env } from "@/lib/env"

export type Session = { userId: string }

export class UnauthenticatedError extends Error {
  constructor() {
    super("No active session.")
    this.name = "UnauthenticatedError"
  }
}

/**
 * Returns the current session, or throws if there is none.
 *
 * Placeholder until the authentication plan lands: it resolves the first seeded
 * user so the screens can be built and used in development, and throws outright
 * in production so this can never serve a real request unauthenticated. Every
 * caller is already written against the final signature, so replacing this body
 * is the whole of the change.
 *
 * @returns The session of the authenticated user.
 * @throws UnauthenticatedError when no user can be resolved, always in production.
 */
export async function requireSession(): Promise<Session> {
  if (env.NODE_ENV === "production") throw new UnauthenticatedError()

  const user = await db.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })

  if (user === null) throw new UnauthenticatedError()

  return { userId: user.id }
}
