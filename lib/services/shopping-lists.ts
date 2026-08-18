import { AISLE_ORDER, AISLE_UNKNOWN, aisleRank } from "@/lib/aisles"
import { db } from "@/lib/db"
import type { ManualItem } from "@/lib/schemas/shopping"
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

export type AisleGroup = { aisle: string; items: StoredItem[] }

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
} as const

/**
 * Gathers the list into the aisles of the supermarket walking order.
 *
 * Exported for its own test. Sorts as well as groups, because the rows arrive
 * from Postgres in whatever order it liked and no SQL `ORDER BY` can express a
 * walking order that is not alphabetical.
 *
 * @param items Every line of the list.
 * @returns One group per aisle that has items, in walking order, each group's
 *   items by name.
 */
export function groupByAisle(items: StoredItem[]): AisleGroup[] {
  const sorted = [...items].sort(
    (a, b) =>
      aisleRank(a.aisle) - aisleRank(b.aisle) ||
      a.name.localeCompare(b.name, "it")
  )

  const groups: AisleGroup[] = []

  for (const item of sorted) {
    const last = groups[groups.length - 1]
    // Adjacency is enough because the sort already put one aisle's items
    // together, and it keeps an unrecognised aisle folded in with the catch-all
    // exactly the way aisleRank ranks it.
    if (last !== undefined && aisleRank(last.aisle) === aisleRank(item.aisle)) {
      last.items.push(item)
      continue
    }
    groups.push({ aisle: item.aisle, items: [item] })
  }

  return groups
}

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
      list: { select: { id: true, items: { select: itemFields } } },
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
 * Ticks or unticks one line, recording who did it.
 *
 * Last-write-wins per item, which §8 of the design accepts at this scale: two
 * people and a checkbox.
 *
 * @param id The line's id.
 * @param actorId The session's user id — never a value from the request body.
 * @param checked The new state.
 * @returns Nothing.
 * @throws NoListError When the line is already gone.
 */
export async function setItemChecked(
  id: string,
  actorId: string,
  checked: boolean
): Promise<void> {
  const updated = await db.shoppingListItem.updateMany({
    where: { id },
    data: {
      checked,
      checkedById: checked ? actorId : null,
      checkedAt: checked ? new Date() : null,
    },
  })

  if (updated.count === 0) throw new NoListError()
}

/**
 * Adds a line by hand, which survives every later regeneration.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @param input The validated line.
 * @returns Nothing.
 * @throws NoListError When the week has no list to add to.
 */
export async function addManualItem(
  weekStart: Date,
  input: ManualItem
): Promise<void> {
  const menu = await db.menu.findUnique({
    where: { weekStart },
    select: { list: { select: { id: true } } },
  })

  if (menu?.list == null) throw new NoListError()

  await db.shoppingListItem.create({
    data: {
      listId: menu.list.id,
      name: input.name,
      quantity: input.quantity,
      unit: input.unit,
      // An aisle nobody recognises would sort with the catch-all anyway; making
      // it the catch-all keeps the stored row honest about where it will show.
      aisle: (AISLE_ORDER as readonly string[]).includes(input.aisle)
        ? input.aisle
        : AISLE_UNKNOWN,
      manual: true,
      // No menu asked for this one.
      days: [],
    },
  })
}

/**
 * Removes a line added by hand.
 *
 * Generated lines are not removable: the next regeneration would bring them
 * back, so the `where` refuses them rather than offering a button that lies.
 *
 * @param id The line's id.
 * @returns Nothing.
 */
export async function removeManualItem(id: string): Promise<void> {
  await db.shoppingListItem.deleteMany({ where: { id, manual: true } })
}
