import { AISLE_UNKNOWN } from "@/lib/aisles"
import { db } from "@/lib/db"
import type { AddShoppingItem } from "@/lib/schemas/shopping"
import { isKnownAisle } from "@/lib/services/catalog"
import { isListStale } from "@/lib/services/menus"
import {
  aggregateShoppingList,
  type AggregatorSlot,
  type ShoppingItem,
} from "@/lib/services/shopping-aggregate"

/** Thrown when a week has no menu, so there is nothing to shop for. */
export class NoMenuError extends Error {
  constructor() {
    super("This week has no menu.")
    this.name = "NoMenuError"
  }
}

/** Thrown when the list a write targets no longer exists. */
export class NoListError extends Error {
  constructor() {
    super("This week has no shopping list.")
    this.name = "NoListError"
  }
}

export type StoredItem = ShoppingItem & { id: string }

export type ShoppingListView = {
  items: StoredItem[]
  generatedAt: Date
  stale: boolean
}

const itemFields = {
  id: true,
  name: true,
  quantity: true,
  unit: true,
  aisle: true,
  checked: true,
  checkedById: true,
  checkedAt: true,
  manual: true,
  days: true,
  takenQuantity: true,
  dismissed: true,
} as const

/**
 * Reads a week's list, and whether the menu has moved on since it was built.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @returns The list, or null when the week has no list yet.
 */
export async function getShoppingList(
  weekStart: Date
): Promise<ShoppingListView | null> {
  const menu = await db.menu.findUnique({
    where: { weekStart },
    select: {
      slotsUpdatedAt: true,
      list: {
        select: { generatedAt: true, items: { select: itemFields } },
      },
    },
  })

  if (menu?.list == null) return null

  return {
    items: menu.list.items,
    generatedAt: menu.list.generatedAt,
    stale: isListStale(menu.slotsUpdatedAt, menu.list.generatedAt),
  }
}

/**
 * Rebuilds a week's list from its menu.
 *
 * The aggregation itself is `aggregateShoppingList`, which is pure and already
 * decides what survives: items added by hand, and the tick on anything whose
 * quantity did not rise. Everything here is loading its input and storing its
 * output, in one transaction so a half-written list can never be shopped from.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @returns Nothing.
 * @throws NoMenuError When the week has no menu to aggregate.
 */
export async function regenerateShoppingList(weekStart: Date): Promise<void> {
  const menu = await db.menu.findUnique({
    where: { weekStart },
    select: {
      id: true,
      slots: {
        select: {
          day: true,
          servings: true,
          recipe: {
            select: {
              servings: true,
              ingredients: {
                select: {
                  quantity: true,
                  unit: true,
                  ingredient: { select: { name: true, aisle: true } },
                },
              },
            },
          },
        },
      },
      list: {
        select: {
          id: true,
          items: { select: itemFields },
          // In the same round trip: the aggregator needs them, and a second
          // query would open a window where a shop closes between the two.
          purchases: {
            select: {
              items: { select: { name: true, unit: true, quantity: true } },
            },
          },
        },
      },
    },
  })

  if (menu === null) throw new NoMenuError()

  const slots: AggregatorSlot[] = menu.slots.map((slot) => ({
    day: slot.day,
    servings: slot.servings,
    recipe:
      slot.recipe === null
        ? null
        : {
            servings: slot.recipe.servings,
            ingredients: slot.recipe.ingredients.map((row) => ({
              name: row.ingredient.name,
              aisle: row.ingredient.aisle,
              quantity: row.quantity,
              unit: row.unit,
            })),
          },
  }))

  const next = aggregateShoppingList({
    slots,
    existing: menu.list?.items ?? [],
    purchased: (menu.list?.purchases ?? []).flatMap(
      (purchase) => purchase.items
    ),
  })

  const generatedAt = new Date()
  const existingList = menu.list

  await db.$transaction(async (tx) => {
    const list =
      existingList === null
        ? await tx.shoppingList.create({
            data: { menuId: menu.id, generatedAt },
            select: { id: true },
          })
        : await tx.shoppingList.update({
            where: { id: existingList.id },
            data: { generatedAt },
            select: { id: true },
          })

    // Replaced wholesale rather than diffed: the aggregator has already decided
    // the final shape of every line, including which ticks survive, so a diff
    // would be a second implementation of the same rules.
    await tx.shoppingListItem.deleteMany({ where: { listId: list.id } })
    await tx.shoppingListItem.createMany({
      data: next.map((item) => ({ ...item, listId: list.id })),
    })
  })
}

/**
 * Ticks or unticks every row behind one line, recording who did it.
 *
 * A line the screen shows is several rows when the menu and a hand-added entry
 * both asked for the same thing, and half a line ticked is not a state the
 * shopper can express. Last-write-wins per row, which §8 of the original design
 * accepts at this scale: two people and a checkbox.
 *
 * @param ids Every row behind the line.
 * @param actorId The session's user id — never a value from the request body.
 * @param checked The new state.
 * @returns Nothing.
 * @throws NoListError When none of the rows is there any more.
 */
export async function setItemChecked(
  ids: string[],
  actorId: string,
  checked: boolean
): Promise<void> {
  const updated = await db.shoppingListItem.updateMany({
    where: { id: { in: ids } },
    data: {
      checked,
      checkedById: checked ? actorId : null,
      checkedAt: checked ? new Date() : null,
    },
  })

  if (updated.count === 0) throw new NoListError()
}

/**
 * Adds a line by hand, and remembers it in the catalogue unless told not to.
 *
 * The line survives every later regeneration, because the aggregator holds
 * hand-added rows apart from generated ones. Both writes are one transaction: a
 * line pointing at a catalogue entry that failed to be created is the kind of
 * half-write that is found a week later.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @param input The validated line, with what to do about the catalogue.
 * @returns Nothing.
 * @throws NoListError When the week has no list to add to.
 */
export async function addManualItem(
  weekStart: Date,
  input: AddShoppingItem
): Promise<void> {
  const menu = await db.menu.findUnique({
    where: { weekStart },
    select: { list: { select: { id: true } } },
  })

  if (menu?.list == null) throw new NoListError()

  const listId = menu.list.id
  // An aisle nobody recognises would sort with the catch-all anyway; making it
  // the catch-all keeps the stored row honest about where it will show.
  const aisle = isKnownAisle(input.aisle) ? input.aisle : AISLE_UNKNOWN

  await db.$transaction(async (tx) => {
    if (input.remember) {
      // Upsert and not create: both phones can add the same new thing at once,
      // and the second must still get its line rather than losing the write.
      // `update: {}` because an entry that already exists was curated by
      // somebody, and a shopping line is not the place to overwrite it.
      await tx.catalogItem.upsert({
        where: { name: input.name },
        update: {},
        create: {
          name: input.name,
          kind: input.kind,
          defaultUnit: input.unit,
          aisle,
        },
      })
    }

    await tx.shoppingListItem.create({
      data: {
        listId,
        name: input.name,
        quantity: input.quantity,
        unit: input.unit,
        aisle,
        manual: true,
        // No menu asked for this one.
        days: [],
      },
    })
  })
}

/**
 * Takes a line off the list: we have it at home, or we are not buying it.
 *
 * One button, two outcomes, because the two kinds of row cannot be treated
 * alike. A hand-added row is deleted — nothing would recreate it, and the `+`
 * puts it back. A generated row is only flagged, because deleting it would last
 * exactly until the next regeneration rebuilt it from the menu. The flag also
 * clears the tick: a line nobody is buying must not walk into the history when
 * the shop is closed.
 *
 * @param ids Every row behind the line.
 * @returns Nothing.
 */
export async function removeFromList(ids: string[]): Promise<void> {
  await db.$transaction([
    db.shoppingListItem.deleteMany({
      where: { id: { in: ids }, manual: true },
    }),
    db.shoppingListItem.updateMany({
      where: { id: { in: ids }, manual: false },
      data: {
        dismissed: true,
        checked: false,
        checkedById: null,
        checkedAt: null,
      },
    }),
  ])
}

/**
 * Puts a dismissed line back among the things to buy.
 *
 * @param ids Every row behind the line.
 * @returns Nothing.
 */
export async function restoreToList(ids: string[]): Promise<void> {
  await db.shoppingListItem.updateMany({
    where: { id: { in: ids } },
    data: { dismissed: false },
  })
}

/**
 * Records how much of a line is actually going in the trolley.
 *
 * The screen shows one line where the database may hold several rows, so the
 * amount is spread over them in turn: each takes as much as it asks for until
 * the amount runs out, and the last row takes whatever is left — which is what
 * lets the shopper take more than the menu asked for. An amount equal to what
 * the line asks for is stored as "no amount at all", so the ordinary case stays
 * the ordinary case and the row shows no correction.
 *
 * @param ids Every row behind the line.
 * @param taken The amount for the whole line, or null to take all of it.
 * @returns Nothing.
 * @throws NoListError When none of the rows is there any more.
 */
export async function setItemTaken(
  ids: string[],
  taken: number | null
): Promise<void> {
  const rows = await db.shoppingListItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, quantity: true },
    // Any stable order will do, and the ids are cuids: monotonic, so this is
    // also the order the rows were created in.
    orderBy: { id: "asc" },
  })

  if (rows.length === 0) throw new NoListError()

  const asked = rows.reduce<number | null>(
    (total, row) =>
      row.quantity === null ? total : (total ?? 0) + row.quantity,
    null
  )

  const share = shareOut(rows, asked === taken ? null : taken)

  await db.$transaction(
    rows.map((row) =>
      db.shoppingListItem.update({
        where: { id: row.id },
        data: { takenQuantity: share.get(row.id) ?? null },
      })
    )
  )
}

// Floating point: 0.1 + 0.2 spread over two rows must still add up to what was
// asked for, so the remainder is rounded at each step rather than accumulated.
const shareOut = (
  rows: { id: string; quantity: number | null }[],
  taken: number | null
): Map<string, number | null> => {
  const share = new Map<string, number | null>()
  if (taken === null) return share

  let left = taken

  rows.forEach((row, index) => {
    const last = index === rows.length - 1
    const mine = last ? left : Math.min(left, row.quantity ?? 0)

    share.set(row.id, Math.round(mine * 100) / 100)
    left = Math.round((left - mine) * 100) / 100
  })

  return share
}
