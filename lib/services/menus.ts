import { db } from "@/lib/db"
import type { EntryAddress, EntryInput, Meal } from "@/lib/schemas/menu"

/** Thrown when an entry names a recipe that is no longer in the database. */
export class UnknownRecipeError extends Error {
  constructor() {
    super("No recipe with this id.")
    this.name = "UnknownRecipeError"
  }
}

/** Thrown when the entry being edited has been removed by another session. */
export class UnknownEntryError extends Error {
  constructor() {
    super("No menu entry with this id.")
    this.name = "UnknownEntryError"
  }
}

export type MenuEntryView = {
  id: string
  day: number
  meal: Meal
  position: number
  recipeId: string | null
  recipeTitle: string | null
  freeText: string | null
  servings: number | null
}

// Prisma's foreign-key failure (P2003), read structurally so this module never
// imports a Prisma type outside lib/db.ts.
function isForeignKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2003"
  )
}

const MEAL_RANK: Record<Meal, number> = { LUNCH: 0, DINNER: 1 }

/**
 * Orders a week's entries the way the grid reads them.
 *
 * Exported for its own test, and a copy rather than a sort in place: the array
 * comes straight from a query and callers do not expect it to move underneath
 * them.
 *
 * The tie on `position` is broken by the id, because two entries added in the
 * same instant may share one — see the column's comment in the schema. Without
 * that last comparison the same data could come back in two different orders.
 *
 * @param stored The entries the week holds, in any order.
 * @returns The same entries, by day, then lunch before dinner, then position.
 */
export function sortEntries(stored: readonly MenuEntryView[]): MenuEntryView[] {
  return [...stored].sort(
    (a, b) =>
      a.day - b.day ||
      MEAL_RANK[a.meal] - MEAL_RANK[b.meal] ||
      a.position - b.position ||
      a.id.localeCompare(b.id)
  )
}

/**
 * Says where the next dish of a meal goes.
 *
 * Exported for its own test. Past the end rather than into the first gap: a gap
 * is what a removal leaves behind, and filling it would drop the new dish into
 * the middle of a list being read top to bottom.
 *
 * @param taken The positions the meal already holds.
 * @returns Zero for an empty meal, otherwise one past the highest.
 */
export function nextPosition(taken: readonly number[]): number {
  return taken.length === 0 ? 0 : Math.max(...taken) + 1
}

/**
 * Says whether a shopping list has been overtaken by its menu.
 *
 * Exported for its own test. Equal instants are not stale: generating the list
 * straight after editing the menu is the normal case, not a warning.
 *
 * @param entriesUpdatedAt When an entry of the week last changed.
 * @param generatedAt When the list was last built.
 * @returns True when the menu moved after the list was built.
 */
export function isListStale(
  entriesUpdatedAt: Date,
  generatedAt: Date
): boolean {
  return entriesUpdatedAt.getTime() > generatedAt.getTime()
}

const entryFields = {
  id: true,
  day: true,
  meal: true,
  position: true,
  recipeId: true,
  freeText: true,
  servings: true,
  recipe: { select: { title: true } },
} as const

/**
 * Reads the dishes one week holds.
 *
 * Sparse by design: a meal holds a list, and most meals hold nothing. A week
 * nobody has touched has no `Menu` row at all and comes back empty, which is a
 * normal state and not an error.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @returns The week's entries, by day, then lunch before dinner, then position.
 */
export async function getMenuWeek(weekStart: Date): Promise<MenuEntryView[]> {
  const menu = await db.menu.findUnique({
    where: { weekStart },
    select: { entries: { select: entryFields } },
  })

  return sortEntries(
    (menu?.entries ?? []).map(({ recipe, ...entry }) => ({
      ...entry,
      recipeTitle: recipe?.title ?? null,
    }))
  )
}

/**
 * Adds a dish to the end of a meal, creating the week the first time.
 *
 * The `Menu` row is upserted: browsing forward must not leave a trail of empty
 * weeks, so the row appears only when it earns one.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @param at Which day and meal the dish joins.
 * @param input The validated entry contents.
 * @returns Nothing.
 * @throws UnknownRecipeError When the recipe was deleted between the picker and the save.
 */
export async function addEntry(
  weekStart: Date,
  at: EntryAddress,
  input: EntryInput
): Promise<void> {
  const menu = await db.menu.upsert({
    where: { weekStart },
    create: { weekStart },
    // The week itself has not changed, but its entries are about to, and the
    // shopping list needs to know. Touched before the write on purpose: a
    // failed write then leaves the list claiming to be stale when it is not,
    // which costs one needless regeneration. The opposite error sends someone
    // to the shop with a list that quietly no longer matches.
    update: { entriesUpdatedAt: new Date() },
    select: { id: true },
  })

  const siblings = await db.menuEntry.findMany({
    where: { menuId: menu.id, day: at.day, meal: at.meal },
    select: { position: true },
  })

  try {
    await db.menuEntry.create({
      data: {
        menuId: menu.id,
        ...at,
        position: nextPosition(siblings.map((row) => row.position)),
        ...input,
      },
    })
  } catch (error) {
    if (isForeignKeyError(error)) throw new UnknownRecipeError()
    throw error
  }
}

/**
 * Rewrites one dish, or removes it when nothing is left in it.
 *
 * An input with all three fields empty deletes the row, delegating to
 * `removeEntry`: an empty entry and an absent entry must mean the same thing,
 * and "svuota i campi per liberare lo slot" is how the drawer says so.
 *
 * @param entryId The entry's id.
 * @param input The validated entry contents.
 * @returns Nothing.
 * @throws UnknownEntryError When the entry was removed by another session.
 * @throws UnknownRecipeError When the recipe was deleted between the picker and the save.
 */
export async function updateEntry(
  entryId: string,
  input: EntryInput
): Promise<void> {
  if (
    input.recipeId === null &&
    input.freeText === null &&
    input.servings === null
  ) {
    return removeEntry(entryId)
  }

  const entry = await db.menuEntry.findUnique({
    where: { id: entryId },
    select: { menuId: true },
  })

  if (entry === null) throw new UnknownEntryError()

  try {
    // One transaction: a write that landed without its touch would leave the
    // shopping list claiming to be current while a dish had just changed.
    await db.$transaction([
      db.menuEntry.update({ where: { id: entryId }, data: input }),
      db.menu.update({
        where: { id: entry.menuId },
        data: { entriesUpdatedAt: new Date() },
      }),
    ])
  } catch (error) {
    if (isForeignKeyError(error)) throw new UnknownRecipeError()
    throw error
  }
}

/**
 * Takes one dish out of its meal.
 *
 * Removing an entry already gone is not an error: two sessions deleting the
 * same row both meant the same thing, and the second must not see a failure.
 * The gap left behind is not closed up — `nextPosition` appends past the
 * highest, so a gap costs nothing.
 *
 * @param entryId The entry's id.
 * @returns Nothing.
 */
export async function removeEntry(entryId: string): Promise<void> {
  const entry = await db.menuEntry.findUnique({
    where: { id: entryId },
    select: { menuId: true },
  })

  if (entry === null) return

  await db.$transaction([
    db.menuEntry.deleteMany({ where: { id: entryId } }),
    db.menu.update({
      where: { id: entry.menuId },
      data: { entriesUpdatedAt: new Date() },
    }),
  ])
}

/**
 * Replaces a whole week's entries in one transaction.
 *
 * Written for the generated proposal, which arrives as a whole week at once.
 * One `addEntry` call per dish would not be atomic, and a failure halfway
 * leaves a half-filled week — which the caller then cannot tell apart from a
 * week somebody built by hand.
 *
 * Every existing entry of the week is removed first, free-text ones included:
 * a proposal replaces the week rather than merging into it, and the caller is
 * responsible for having asked before calling this.
 *
 * Positions come from the order of the array, counted within each meal, so the
 * caller never has to think about them.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @param entries The dishes to write; an empty array clears the week.
 * @returns Nothing.
 * @throws UnknownRecipeError When a recipe was deleted between the proposal and the write.
 */
export async function replaceWeekEntries(
  weekStart: Date,
  entries: readonly { day: number; meal: Meal; recipeId: string }[]
): Promise<void> {
  const menu = await db.menu.upsert({
    where: { weekStart },
    create: { weekStart },
    update: { entriesUpdatedAt: new Date() },
    select: { id: true },
  })

  const used = new Map<string, number>()
  const rows = entries.map((entry) => {
    const key = `${entry.day}-${entry.meal}`
    const position = used.get(key) ?? 0
    used.set(key, position + 1)

    return { menuId: menu.id, ...entry, position }
  })

  try {
    await db.$transaction([
      db.menuEntry.deleteMany({ where: { menuId: menu.id } }),
      db.menuEntry.createMany({ data: rows }),
    ])
  } catch (error) {
    if (isForeignKeyError(error)) throw new UnknownRecipeError()
    throw error
  }
}

/**
 * Whether the week holds nothing at all.
 *
 * Read on the server before a generation overwrites it: the page hides the
 * button on a filled week, but a server action is a public endpoint and a
 * hidden button is not a guard.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @returns True when the week holds no entry.
 */
export async function isWeekEmpty(weekStart: Date): Promise<boolean> {
  const filled = await db.menuEntry.count({ where: { menu: { weekStart } } })

  return filled === 0
}
