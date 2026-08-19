import { db } from "@/lib/db"
import { NoListError } from "@/lib/services/shopping-lists"

/** Thrown when a shop is closed with nothing ticked. */
export class NothingCheckedError extends Error {
  constructor() {
    super("No item is checked.")
    this.name = "NothingCheckedError"
  }
}

export type PurchaseSummary = {
  id: string
  purchasedAt: Date
  weekStart: Date
  itemCount: number
  totalCents: number | null
}

export type PurchaseLine = {
  id: string
  name: string
  quantity: number | null
  unit: string | null
  aisle: string
}

export type PurchaseDetail = {
  id: string
  purchasedAt: Date
  weekStart: Date
  totalCents: number | null
  lines: PurchaseLine[]
}

/**
 * Moves everything ticked off a week's list into a dated purchase.
 *
 * The read and the write are one transaction, so a tick arriving from the other
 * phone between them cannot be half-recorded. The lines are copied rather than
 * referenced: a history must say what was bought then, and the rows themselves
 * go — which is what leaves the list holding only what is still to buy.
 *
 * A row the shopper took only part of is recorded at what was taken and stays
 * on the list holding the difference, unticked. Taking more than the menu asked
 * for is recorded in full and clears the row, because there is no difference
 * left to buy.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @param totalCents What was paid, or null to fill in later.
 * @returns Nothing.
 * @throws NoListError When the week has no list.
 * @throws NothingCheckedError When nothing on it is ticked.
 */
export async function completePurchase(
  weekStart: Date,
  totalCents: number | null
): Promise<void> {
  const menu = await db.menu.findUnique({
    where: { weekStart },
    select: { list: { select: { id: true } } },
  })

  if (menu?.list == null) throw new NoListError()

  const listId = menu.list.id

  await db.$transaction(async (tx) => {
    const checked = await tx.shoppingListItem.findMany({
      // dismissed is belt and braces: taking a line off the list already clears
      // its tick, so a row that is both would be a bug elsewhere. It must not
      // become a purchase either way.
      where: { listId, checked: true, dismissed: false },
      select: {
        id: true,
        name: true,
        quantity: true,
        unit: true,
        aisle: true,
        takenQuantity: true,
      },
    })

    if (checked.length === 0) throw new NothingCheckedError()

    const bought = checked.map((row) => ({
      row,
      quantity: row.takenQuantity ?? row.quantity,
    }))

    await tx.purchase.create({
      data: {
        listId,
        totalCents,
        // The row's own id is dropped: a PurchaseItem is a copy and gets its
        // own, and reusing the shopping row's would suggest a link that the
        // delete below is about to break.
        items: {
          create: bought.map(({ row, quantity }) => ({
            name: row.name,
            quantity,
            unit: row.unit,
            aisle: row.aisle,
          })),
        },
      },
      select: { id: true },
    })

    // flatMap rather than filter, so what is left of each row is worked out
    // where TypeScript can still see that neither number is null.
    const partial = bought.flatMap(({ row, quantity }) =>
      row.quantity !== null && quantity !== null && quantity < row.quantity
        ? [
            {
              id: row.id,
              left: Math.round((row.quantity - quantity) * 100) / 100,
            },
          ]
        : []
    )
    const partialIds = new Set(partial.map((row) => row.id))

    for (const row of partial) {
      await tx.shoppingListItem.update({
        where: { id: row.id },
        // The days are left alone: what is still wanted is still wanted on the
        // same days. The tick goes, because it is no longer true.
        data: {
          quantity: row.left,
          takenQuantity: null,
          checked: false,
          checkedById: null,
          checkedAt: null,
        },
      })
    }

    await tx.shoppingListItem.deleteMany({
      where: {
        id: {
          in: bought
            .map(({ row }) => row.id)
            .filter((id) => !partialIds.has(id)),
        },
      },
    })
  })
}

/**
 * Every purchase ever made, newest first.
 *
 * Crosses the weeks on purpose: seeing the spend is the point, and a history
 * paged by week could not show it. Loaded whole because it is small — one
 * household, a handful of trips a week.
 *
 * @returns Every purchase, with the week it belonged to and how many lines it
 *   holds.
 */
export async function listPurchases(): Promise<PurchaseSummary[]> {
  const rows = await db.purchase.findMany({
    select: {
      id: true,
      purchasedAt: true,
      totalCents: true,
      list: { select: { menu: { select: { weekStart: true } } } },
      _count: { select: { items: true } },
    },
    orderBy: { purchasedAt: "desc" },
  })

  return rows.map((row) => ({
    id: row.id,
    purchasedAt: row.purchasedAt,
    weekStart: row.list.menu.weekStart,
    itemCount: row._count.items,
    totalCents: row.totalCents,
  }))
}

/**
 * Reads one purchase and everything in it.
 *
 * @param id The purchase's id.
 * @returns The purchase, or null when there is no such id.
 */
export async function getPurchase(id: string): Promise<PurchaseDetail | null> {
  const row = await db.purchase.findUnique({
    where: { id },
    select: {
      id: true,
      purchasedAt: true,
      totalCents: true,
      list: { select: { menu: { select: { weekStart: true } } } },
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          unit: true,
          aisle: true,
        },
      },
    },
  })

  if (row === null) return null

  return {
    id: row.id,
    purchasedAt: row.purchasedAt,
    weekStart: row.list.menu.weekStart,
    totalCents: row.totalCents,
    lines: row.items,
  }
}

/**
 * Sets or clears what a purchase cost.
 *
 * @param id The purchase's id.
 * @param totalCents The amount in cents, or null to say it is not known yet.
 * @returns Nothing.
 */
export async function setPurchaseTotal(
  id: string,
  totalCents: number | null
): Promise<void> {
  // updateMany rather than update: an id that no longer exists is a race with
  // the other phone, not an error worth throwing at the user.
  await db.purchase.updateMany({ where: { id }, data: { totalCents } })
}
