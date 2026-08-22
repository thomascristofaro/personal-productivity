import { db } from "@/lib/db"
import type {
  FinanceAccountInput,
  FinanceProvider,
} from "@/lib/schemas/finance"
import {
  AccountNotVisibleError,
  assertAccountVisible,
  visibleTo,
} from "@/lib/services/finance/access"
import { balanceCents } from "@/lib/services/finance/balance"

export type AccountSummary = {
  id: string
  name: string
  provider: FinanceProvider
  shared: boolean
  // Whether the actor owns it. Shown as a badge; never used to decide access,
  // which visibleTo already did inside the query.
  isOwn: boolean
  balanceCents: number
  lastMovementAt: Date | null
}

export type AccountDetail = AccountSummary & {
  openingBalanceCents: number
  openingBalanceAt: Date
}

const SELECTION = {
  id: true,
  name: true,
  provider: true,
  shared: true,
  ownerId: true,
  openingBalanceCents: true,
  openingBalanceAt: true,
  movements: { select: { date: true, amountCents: true } },
} as const

type Row = {
  id: string
  name: string
  provider: FinanceProvider
  shared: boolean
  ownerId: string
  openingBalanceCents: number
  openingBalanceAt: Date
  movements: { date: Date; amountCents: number }[]
}

function summarise(row: Row, actorId: string): AccountDetail {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    shared: row.shared,
    isOwn: row.ownerId === actorId,
    openingBalanceCents: row.openingBalanceCents,
    openingBalanceAt: row.openingBalanceAt,
    balanceCents: balanceCents(
      row.openingBalanceCents,
      row.openingBalanceAt,
      row.movements
    ),
    lastMovementAt: row.movements.reduce<Date | null>(
      (latest, movement) =>
        latest === null || movement.date > latest ? movement.date : latest,
      null
    ),
  }
}

/**
 * Every account the user can see, with what it holds now.
 *
 * Loads the movements to sum them, which is the honest reading of "derived,
 * never stored" at this size — one household, a few thousand rows. If it ever
 * drags, the fix is a grouped aggregate here and nowhere else.
 *
 * @param actorId - the user id, from the session
 * @returns the accounts, the user's own first and then by name
 */
export async function listAccounts(actorId: string): Promise<AccountSummary[]> {
  const rows = await db.financeAccount.findMany({
    where: visibleTo(actorId),
    select: SELECTION,
    orderBy: [{ name: "asc" }],
  })

  return rows
    .map((row) => summarise(row, actorId))
    .sort((a, b) => Number(b.isOwn) - Number(a.isOwn))
}

/**
 * One account, or null when the user cannot see it.
 *
 * Null and not a throw: the page answers with notFound(), and saying "it exists
 * but is not yours" would already be saying something.
 *
 * @param actorId - the user id, from the session
 * @param id - the account's id
 * @returns the account with its opening balance, or null
 */
export async function getAccount(
  actorId: string,
  id: string
): Promise<AccountDetail | null> {
  const row = await db.financeAccount.findFirst({
    where: { id, ...visibleTo(actorId) },
    select: SELECTION,
  })

  return row === null ? null : summarise(row, actorId)
}

/**
 * Opens an account, owned by whoever created it.
 *
 * @param actorId - the user id, from the session
 * @param input - the validated form
 * @returns the new account's id
 */
export async function createAccount(
  actorId: string,
  input: FinanceAccountInput
): Promise<string> {
  const created = await db.financeAccount.create({
    data: {
      name: input.name,
      provider: input.provider,
      shared: input.shared,
      openingBalanceCents: input.openingBalanceCents,
      openingBalanceAt: input.openingBalanceAt,
      ownerId: actorId,
    },
    select: { id: true },
  })

  return created.id
}

/**
 * Changes an account's name, provider, sharing or opening balance.
 *
 * The owner is never changed here: an account changing hands is not something
 * this app does, and allowing it from a form would put the ownership rule in
 * reach of anyone who can see the account.
 *
 * @param actorId - the user id, from the session
 * @param id - the account's id
 * @param input - the validated form
 * @returns nothing
 * @throws AccountNotVisibleError when the user cannot see the account
 */
export async function updateAccount(
  actorId: string,
  id: string,
  input: FinanceAccountInput
): Promise<void> {
  await assertAccountVisible(actorId, id)

  await db.financeAccount.update({
    where: { id },
    data: {
      name: input.name,
      provider: input.provider,
      shared: input.shared,
      openingBalanceCents: input.openingBalanceCents,
      openingBalanceAt: input.openingBalanceAt,
    },
  })
}

export { AccountNotVisibleError }
