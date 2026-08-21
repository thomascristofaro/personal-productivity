import { db } from "@/lib/db"
import { env } from "@/lib/env"

import { requireSession, type Session } from "./index"

/** The signed-in user is not the owner. */
export class NotOwnerError extends Error {
  constructor() {
    super("Questa sezione è riservata.")
    this.name = "NotOwnerError"
  }
}

/**
 * Whether an address is the owner's.
 *
 * `OWNER_EMAIL` already exists and already decides which seeded user is which,
 * so this module needs no role column and no migration — design document
 * 2026-08-21 section 7.4.
 *
 * @param email The address to check.
 * @returns True when it is the owner's, compared case-insensitively.
 */
export function isOwner(email: string): boolean {
  return email.toLowerCase() === env.OWNER_EMAIL.toLowerCase()
}

/**
 * Requires the signed-in user to be the owner.
 *
 * Called inside every server action of this module, not only in the pages: an
 * action is a public endpoint and a page-level check does not protect it.
 *
 * A `Session` carries only a `userId`, so the address is read from the database
 * rather than from the session — one extra query on a screen nobody but the
 * owner reaches.
 *
 * @returns The session, so the caller does not fetch it twice.
 * @throws NotOwnerError When somebody else is signed in.
 */
export async function requireOwner(): Promise<Session> {
  const session = await requireSession()

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  })

  if (user === null || !isOwner(user.email)) throw new NotOwnerError()

  return session
}
