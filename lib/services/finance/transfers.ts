import { TRANSFER_WINDOW_DAYS } from "@/lib/config"
import { db } from "@/lib/db"
import { visibleTo } from "@/lib/services/finance/access"
import { transferCategoryId } from "@/lib/services/finance/categories"
import { categorise } from "@/lib/services/finance/categorise"
import { pairCandidates } from "@/lib/services/finance/pairing"
import { matchableRules } from "@/lib/services/finance/rules"

export type CandidateLeg = {
  id: string
  date: Date
  amountCents: number
  description: string
  accountName: string
}

export type CandidatePair = {
  outgoing: CandidateLeg
  incoming: CandidateLeg
  daysApart: number
  // True when one of the two legs has another candidate. The screen shows
  // these together and does not offer a bulk confirm for them.
  contested: boolean
}

/** Thrown when two movements are asked to be a pair and cannot be one. */
export class TransferNotPairableError extends Error {
  constructor() {
    super("Those two movements cannot be a transfer.")
    this.name = "TransferNotPairableError"
  }
}

const LEG = {
  id: true,
  accountId: true,
  date: true,
  amountCents: true,
  description: true,
  account: { select: { name: true } },
} as const

async function unlinkedMovements(actorId: string) {
  return db.movement.findMany({
    where: {
      account: visibleTo(actorId),
      transferFrom: null,
      transferTo: null,
    },
    select: LEG,
  })
}

/**
 * The pairs that look like one movement of money between two accounts.
 *
 * Runs over every unlinked movement, not only the ones just imported: Revolut
 * is exported today and Intesa next week, and the pair forms next week.
 *
 * @param actorId - the user id, from the session
 * @returns the candidates, settled ones first and newest first within each
 *   group
 */
export async function listTransferCandidates(
  actorId: string
): Promise<CandidatePair[]> {
  const rows = await unlinkedMovements(actorId)
  const byId = new Map(rows.map((row) => [row.id, row]))

  const leg = (id: string): CandidateLeg => {
    const row = byId.get(id)
    if (row === undefined) throw new TransferNotPairableError()
    return {
      id: row.id,
      date: row.date,
      amountCents: row.amountCents,
      description: row.description,
      accountName: row.account.name,
    }
  }

  const { settled, contested } = pairCandidates(rows, TRANSFER_WINDOW_DAYS)

  const pairs = [
    ...settled.map((pair) => ({ ...pair, contested: false })),
    ...contested.map((pair) => ({ ...pair, contested: true })),
  ]

  return pairs
    .map((pair) => ({
      outgoing: leg(pair.outgoingId),
      incoming: leg(pair.incomingId),
      daysApart: pair.daysApart,
      contested: pair.contested,
    }))
    .sort((a, b) => {
      if (a.contested !== b.contested) return a.contested ? 1 : -1
      return b.outgoing.date.getTime() - a.outgoing.date.getTime()
    })
}

/**
 * How many pairs are waiting to be confirmed.
 *
 * The number the summary shows, and the reason the totals under it are not yet
 * true: an unconfirmed transfer counts as both income and an outgoing.
 *
 * @param actorId - the user id, from the session
 * @returns the count
 */
export async function countTransferCandidates(
  actorId: string
): Promise<number> {
  const rows = await unlinkedMovements(actorId)
  const { settled, contested } = pairCandidates(rows, TRANSFER_WINDOW_DAYS)
  return settled.length + contested.length
}

/**
 * Links two movements as the two legs of one transfer.
 *
 * Both take the TRANSFER category, so the summary has one rule to obey and not
 * two. Re-checks the pairing conditions rather than trusting the caller: this
 * runs from a server action, which is a public endpoint, and a forged pair
 * would hide an expense in the one category the totals ignore.
 *
 * @param actorId - the user id, from the session
 * @param outgoingId - the leg that left
 * @param incomingId - the leg that arrived
 * @returns nothing
 * @throws TransferNotPairableError when the two are not a possible pair, one of
 *   them is already linked, or either is on an account the user cannot see
 */
export async function confirmTransfer(
  actorId: string,
  outgoingId: string,
  incomingId: string
): Promise<void> {
  if (outgoingId === incomingId) throw new TransferNotPairableError()

  const rows = await db.movement.findMany({
    where: {
      id: { in: [outgoingId, incomingId] },
      account: visibleTo(actorId),
      transferFrom: null,
      transferTo: null,
    },
    select: { id: true, accountId: true, date: true, amountCents: true },
  })

  const outgoing = rows.find((row) => row.id === outgoingId)
  const incoming = rows.find((row) => row.id === incomingId)
  if (outgoing === undefined || incoming === undefined) {
    throw new TransferNotPairableError()
  }

  const { settled, contested } = pairCandidates(
    [outgoing, incoming],
    TRANSFER_WINDOW_DAYS
  )
  const allowed = [...settled, ...contested].some(
    (pair) => pair.outgoingId === outgoingId && pair.incomingId === incomingId
  )
  if (!allowed) throw new TransferNotPairableError()

  const categoryId = await transferCategoryId()

  await db.$transaction([
    db.transferLink.create({
      data: { fromMovementId: outgoingId, toMovementId: incomingId },
    }),
    db.movement.updateMany({
      where: { id: { in: [outgoingId, incomingId] } },
      data: { categoryId, categorySource: "TRANSFER_LINK" },
    }),
  ])
}

/**
 * Breaks a link, and lets the rules have another go at both legs.
 *
 * Re-running the rules rather than clearing the category outright: it leaves
 * each leg either recategorised or back under «Da categorizzare», and never
 * leaves «Trasferimento» on a movement that is no longer one.
 *
 * @param actorId - the user id, from the session
 * @param movementId - either leg
 * @returns nothing
 */
export async function unlinkTransfer(
  actorId: string,
  movementId: string
): Promise<void> {
  // The visibility is checked on the movement the caller named, not on one of
  // the two legs by position: a link spans two accounts, and the two need not
  // be visible to the same person. Checking `fromMovement` would refuse a
  // legitimate unlink from the other side, and pass one it should refuse.
  const named = await db.movement.findFirst({
    where: { id: movementId, account: visibleTo(actorId) },
    select: { id: true },
  })
  if (named === null) return

  const link = await db.transferLink.findFirst({
    where: {
      OR: [{ fromMovementId: movementId }, { toMovementId: movementId }],
    },
    select: { id: true, fromMovementId: true, toMovementId: true },
  })
  if (link === null) return

  const ids = [link.fromMovementId, link.toMovementId]

  await db.$transaction([
    db.transferLink.delete({ where: { id: link.id } }),
    db.movement.updateMany({
      where: { id: { in: ids } },
      data: { categoryId: null, categorySource: "NONE" },
    }),
  ])

  const rules = await matchableRules()
  const rows = await db.movement.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      accountId: true,
      description: true,
      providerCategory: true,
    },
  })

  for (const row of rows) {
    const match = categorise(rules, row)
    if (match === null) continue
    await db.movement.update({
      where: { id: row.id },
      data: { categoryId: match.categoryId, categorySource: match.source },
    })
  }
}
