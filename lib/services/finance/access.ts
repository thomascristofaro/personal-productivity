import { db } from "@/lib/db"

/** Thrown when an account is asked for by someone who cannot see it. */
export class AccountNotVisibleError extends Error {
  constructor() {
    super("The account is not visible to this user.")
    this.name = "AccountNotVisibleError"
  }
}

/**
 * The account condition every query in the module carries.
 *
 * Written once so it cannot drift between a read that uses it and a write that
 * remembered only half of it.
 *
 * @param actorId - the user id, from the session
 * @returns a Prisma condition matching the accounts they may see
 */
export function visibleTo(actorId: string) {
  return { OR: [{ ownerId: actorId }, { shared: true }] }
}

/**
 * The accounts a user may see: their own, plus the shared ones.
 *
 * This is the module's whole authorisation rule. Every read and every write
 * starts here and filters inside its query — a check applied after a query has
 * already returned rows is the IDOR this exists to prevent.
 *
 * @param actorId - the user id, from the session and never from a payload
 * @returns their ids, in no particular order
 */
export async function visibleAccountIds(actorId: string): Promise<string[]> {
  const rows = await db.financeAccount.findMany({
    where: visibleTo(actorId),
    select: { id: true },
  })

  return rows.map((row) => row.id)
}

/**
 * Refuses when a user cannot see an account.
 *
 * @param actorId - the user id, from the session
 * @param accountId - the account being written to
 * @returns nothing
 * @throws AccountNotVisibleError when the account is invisible or absent
 */
export async function assertAccountVisible(
  actorId: string,
  accountId: string
): Promise<void> {
  const account = await db.financeAccount.findFirst({
    where: { id: accountId, ...visibleTo(actorId) },
    select: { id: true },
  })

  if (account === null) throw new AccountNotVisibleError()
}
