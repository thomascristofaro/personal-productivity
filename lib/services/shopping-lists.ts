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
 * Removes the rows of a line that were added by hand.
 *
 * Generated rows are not removable: the next regeneration would bring them
 * back, so the `where` refuses them rather than offering a button that lies. A
 * line that is part generated and part hand-added therefore survives with only
 * what the menu asks for, which is the point.
 *
 * @param ids The rows to remove.
 * @returns Nothing.
 */
export async function removeManualItems(ids: string[]): Promise<void> {
  await db.shoppingListItem.deleteMany({
    where: { id: { in: ids }, manual: true },
  })
}
