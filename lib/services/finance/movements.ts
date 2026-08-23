import { db } from "@/lib/db"
import { visibleAccountIds, visibleTo } from "@/lib/services/finance/access"

// Three accounts produce roughly two thousand movements a year, and every
// filter change re-runs the query. Fifty is a screenful and a half.
export const MOVEMENTS_PAGE_SIZE = 50

// Far past any real history, and near enough that a hand-typed offset cannot
// ask Postgres to skip a hundred million rows.
const MAX_OFFSET = 100_000

// What the detail screen shows of the other leg of a transfer.
const TWIN = {
  id: true,
  description: true,
  account: { select: { name: true } },
} as const

// The value the category chip carries for the movements nobody has classified
// yet. Not a category id, because "no category" is not a category.
export const UNCATEGORISED_FILTER = "uncategorised"

export type MovementFilters = {
  accountId?: string
  q?: string
  // UNCATEGORISED_FILTER, or a category id.
  category?: string
}

export type MovementRow = {
  id: string
  date: Date
  amountCents: number
  description: string
  accountName: string
  categoryName: string | null
}

export type MovementPage = {
  rows: MovementRow[]
  hasMore: boolean
  nextOffset: number
}

export type MovementTwin = {
  id: string
  description: string
  accountName: string
}

export type MovementDetail = MovementRow & {
  accountId: string
  categoryId: string | null
  providerCategory: string | null
  providerRef: string | null
  note: string | null
  importedAt: Date | null
  importFileName: string | null
  // The other leg of a confirmed transfer, or null when this movement is not
  // part of one.
  twin: MovementTwin | null
}

/**
 * How far into the list an address is asking to start.
 *
 * @param raw - the offset search param, as Next delivered it
 * @returns a whole number between zero and the cap
 */
export function offsetFrom(raw: string | undefined): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.min(Math.floor(parsed), MAX_OFFSET)
}

/**
 * A page of movements, newest first, across the accounts the user can see.
 *
 * Not bound to a month: the summary is where a month is the unit, and making
 * the list ask for one would mean guessing the month before searching for a
 * payment.
 *
 * @param actorId - the user id, from the session
 * @param filters - the account and the text typed, both optional
 * @param offset - how many rows to skip
 * @returns the page, and whether another one follows
 */
export async function listMovements(
  actorId: string,
  filters: MovementFilters,
  offset: number
): Promise<MovementPage> {
  const visible = await visibleAccountIds(actorId)

  // An account filter naming something invisible narrows to nothing rather than
  // widening to everything: the intersection is the safe direction.
  const accountIds =
    filters.accountId === undefined
      ? visible
      : visible.filter((id) => id === filters.accountId)

  if (accountIds.length === 0) {
    return { rows: [], hasMore: false, nextOffset: offset }
  }

  const query = filters.q?.trim() ?? ""

  const rows = await db.movement.findMany({
    where: {
      accountId: { in: accountIds },
      ...(query === ""
        ? {}
        : { description: { contains: query, mode: "insensitive" as const } }),
      ...(filters.category === undefined
        ? {}
        : filters.category === UNCATEGORISED_FILTER
          ? { categoryId: null }
          : { categoryId: filters.category }),
    },
    select: {
      id: true,
      date: true,
      amountCents: true,
      description: true,
      account: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    skip: offset,
    // One more than the page, so "is there another page" needs no second query.
    take: MOVEMENTS_PAGE_SIZE + 1,
  })

  const page = rows.slice(0, MOVEMENTS_PAGE_SIZE)

  return {
    rows: page.map((row) => ({
      id: row.id,
      date: row.date,
      amountCents: row.amountCents,
      description: row.description,
      accountName: row.account.name,
      categoryName: row.category?.name ?? null,
    })),
    hasMore: rows.length > MOVEMENTS_PAGE_SIZE,
    nextOffset: offset + MOVEMENTS_PAGE_SIZE,
  }
}

/**
 * One movement, or null when the user cannot see its account.
 *
 * @param actorId - the user id, from the session
 * @param id - the movement's id
 * @returns the movement with what the provider said and what was decided, or
 *   null
 */
export async function getMovement(
  actorId: string,
  id: string
): Promise<MovementDetail | null> {
  const row = await db.movement.findFirst({
    where: { id, account: visibleTo(actorId) },
    select: {
      id: true,
      date: true,
      amountCents: true,
      description: true,
      providerCategory: true,
      providerRef: true,
      note: true,
      accountId: true,
      categoryId: true,
      account: { select: { name: true } },
      category: { select: { name: true } },
      importBatch: { select: { createdAt: true, fileName: true } },
      // Both sides, because a movement may be either leg and the screen does
      // not care which: what it shows is "the other one".
      transferFrom: { select: { toMovement: { select: TWIN } } },
      transferTo: { select: { fromMovement: { select: TWIN } } },
    },
  })

  if (row === null) return null

  const other = row.transferFrom?.toMovement ?? row.transferTo?.fromMovement

  return {
    id: row.id,
    date: row.date,
    amountCents: row.amountCents,
    description: row.description,
    accountId: row.accountId,
    accountName: row.account.name,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    providerCategory: row.providerCategory,
    providerRef: row.providerRef,
    note: row.note,
    importedAt: row.importBatch?.createdAt ?? null,
    importFileName: row.importBatch?.fileName ?? null,
    twin:
      other === undefined
        ? null
        : {
            id: other.id,
            description: other.description,
            accountName: other.account.name,
          },
  }
}

/**
 * Sets a movement's category by hand.
 *
 * `MANUAL` is what protects it: a rule applied backwards skips it afterwards,
 * because a rule may improve a guess and may not overrule a decision.
 *
 * @param actorId - the user id, from the session
 * @param id - the movement's id
 * @param categoryId - the chosen category
 * @returns whether a row was written
 */
export async function setMovementCategory(
  actorId: string,
  id: string,
  categoryId: string
): Promise<boolean> {
  const { count } = await db.movement.updateMany({
    where: { id, account: visibleTo(actorId) },
    data: { categoryId, categorySource: "MANUAL" },
  })

  return count > 0
}

/**
 * Writes the owner's own remark on a movement.
 *
 * The only field of a movement anyone may write. The imported ones are not:
 * correcting a description would make the next import of that period see an
 * unrecognised row and write it again beside the correction.
 *
 * @param actorId - the user id, from the session
 * @param id - the movement's id
 * @param note - the remark, or null to clear it
 * @returns whether a row was written
 */
export async function setMovementNote(
  actorId: string,
  id: string,
  note: string | null
): Promise<boolean> {
  // updateMany with the visibility inside the filter: an id the user cannot see
  // matches nothing and writes nothing, with no second round trip to check.
  const { count } = await db.movement.updateMany({
    where: { id, account: visibleTo(actorId) },
    data: { note },
  })

  return count > 0
}
