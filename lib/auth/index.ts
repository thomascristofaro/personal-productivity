import "server-only"

import { headers } from "next/headers"

import { auth } from "@/lib/auth/better-auth"
import { db } from "@/lib/db"
import { env } from "@/lib/env"

export type Session = { userId: string }

export class UnauthenticatedError extends Error {
  constructor() {
    super("No active session.")
    this.name = "UnauthenticatedError"
  }
}

// Development convenience, kept deliberately — see the authentication design
// section 9. It applies only when there is no real session, so signing in
// locally exercises the real path without a code change, and production can
// never reach it.
async function developmentFallback(): Promise<Session | null> {
  if (env.NODE_ENV === "production") return null

  const user = await db.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })

  return user === null ? null : { userId: user.id }
}

/**
 * Returns the session better-auth issued, or null when there is none.
 *
 * The development fallback is deliberately not applied. The login screen asks
 * this one: were it to ask getSession(), it would see the fallback in
 * development, redirect to the app, and bounce back off the middleware.
 *
 * @returns The verified session, or null.
 */
export async function getVerifiedSession(): Promise<Session | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  return session == null ? null : { userId: session.user.id }
}

/**
 * Returns who the app should treat as the current user, or null.
 *
 * For callers that redirect rather than fail — the app layout. A server action
 * wants requireSession() instead. In development this falls back to the first
 * seeded user; in production it is exactly getVerifiedSession().
 *
 * @returns The session of the current user, or null.
 */
export async function getSession(): Promise<Session | null> {
  return (await getVerifiedSession()) ?? developmentFallback()
}

/**
 * Returns the current session, or throws if there is none.
 *
 * @returns The session of the authenticated user.
 * @throws UnauthenticatedError when no session can be resolved.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (session === null) throw new UnauthenticatedError()
  return session
}
