import { courseRank, type Course } from "@/lib/courses"
import { db } from "@/lib/db"
import type { Meal, SlotAddress, SlotInput } from "@/lib/schemas/menu"

/** Thrown when a slot names a recipe that is no longer in the database. */
export class UnknownRecipeError extends Error {
  constructor() {
    super("No recipe with this id.")
    this.name = "UnknownRecipeError"
  }
}

export type MenuSlotView = {
  day: number
  meal: Meal
  course: Course
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
 * Orders a week's slots the way the grid reads them.
 *
 * Exported for its own test, and a copy rather than a sort in place: the array
 * comes straight from a query, and callers do not expect it to move underneath
 * them.
 *
 * The ranks are explicit rather than an `orderBy` on the two enum columns.
 * Postgres does order an enum by its declaration order, so the query would
 * work — but that would make the grid's order depend on the order of three
 * lines in the schema, with nothing on screen to say so.
 *
 * @param stored The slots the week holds, in any order.
 * @returns The same slots, by day, then lunch before dinner, then by course.
 */
export function sortSlots(stored: readonly MenuSlotView[]): MenuSlotView[] {
  return [...stored].sort(
    (a, b) =>
      a.day - b.day ||
      MEAL_RANK[a.meal] - MEAL_RANK[b.meal] ||
      courseRank(a.course) - courseRank(b.course)
  )
}

/**
 * Says whether a shopping list has been overtaken by its menu.
 *
 * Exported for its own test. Equal instants are not stale: generating the list
 * straight after editing the menu is the normal case, not a warning.
 *
 * @param slotsUpdatedAt When a slot of the week last changed.
 * @param generatedAt When the list was last built.
 * @returns True when the menu moved after the list was built.
 */
export function isListStale(slotsUpdatedAt: Date, generatedAt: Date): boolean {
  return slotsUpdatedAt.getTime() > generatedAt.getTime()
}

/**
 * Reads the slots one week holds.
 *
 * Sparse by design: a meal has three courses and rarely three dishes, so only
 * the rows that exist come back. Every one of them is a filled row, because
 * `setSlot` deletes a slot whose fields are all empty. A week nobody has touched
 * has no `Menu` row at all and comes back empty, which is a normal state and not
 * an error.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @returns The week's slots, by day, then lunch before dinner, then by course.
 */
export async function getMenuWeek(weekStart: Date): Promise<MenuSlotView[]> {
  const menu = await db.menu.findUnique({
    where: { weekStart },
    select: {
      slots: {
        select: {
          day: true,
          meal: true,
          course: true,
          recipeId: true,
          freeText: true,
          servings: true,
          recipe: { select: { title: true } },
        },
      },
    },
  })

  return sortSlots(
    (menu?.slots ?? []).map(({ recipe, ...slot }) => ({
      ...slot,
      recipeTitle: recipe?.title ?? null,
    }))
  )
}

/**
 * Writes one slot, creating the week the first time anything is saved into it.
 *
 * The `Menu` row is upserted with an empty update: browsing forward must not
 * leave a trail of empty weeks, so the row appears only when it earns one.
 *
 * An input with all three fields empty deletes the row instead, delegating to
 * `clearSlot`: an empty slot and an absent slot must mean the same thing.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @param address Which day, meal and course the slot occupies.
 * @param input The validated slot contents.
 * @returns Nothing.
 * @throws UnknownRecipeError When the recipe was deleted between the picker and the save.
 */
export async function setSlot(
  weekStart: Date,
  address: SlotAddress,
  input: SlotInput
): Promise<void> {
  // An empty slot and an absent slot must mean the same thing — see clearSlot's
  // reasoning below. Writing a row with three nulls would break that, and the
  // drawer now reaches this path every time somebody clears a slot by hand.
  if (
    input.recipeId === null &&
    input.freeText === null &&
    input.servings === null
  ) {
    return clearSlot(weekStart, address)
  }

  const menu = await db.menu.upsert({
    where: { weekStart },
    create: { weekStart },
    // The week itself has not changed, but its slots are about to, and the
    // shopping list needs to know. Touched before the slot write on purpose: a
    // failed write then leaves the list claiming to be stale when it is not,
    // which costs one needless regeneration. The opposite error sends someone
    // to the shop with a list that quietly no longer matches.
    update: { slotsUpdatedAt: new Date() },
    select: { id: true },
  })

  try {
    await db.menuSlot.upsert({
      where: { menuId_day_meal_course: { menuId: menu.id, ...address } },
      create: { menuId: menu.id, ...address, ...input },
      update: input,
    })
  } catch (error) {
    if (isForeignKeyError(error)) throw new UnknownRecipeError()
    throw error
  }
}

/**
 * Empties one slot.
 *
 * Deletes the row rather than blanking its columns: an empty slot and an absent
 * slot must mean the same thing, and the sparse grid already makes them look
 * identical on screen. Uses `deleteMany` so clearing an already-empty slot is
 * not an error.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @param address Which day, meal and course the slot occupies.
 * @returns Nothing.
 */
export async function clearSlot(
  weekStart: Date,
  address: SlotAddress
): Promise<void> {
  const menu = await db.menu.findUnique({
    where: { weekStart },
    select: { id: true },
  })

  if (menu === null) return

  // One transaction: a delete that landed without its touch would leave the
  // shopping list claiming to be current while an item had just left the menu.
  await db.$transaction([
    db.menuSlot.deleteMany({ where: { menuId: menu.id, ...address } }),
    db.menu.update({
      where: { id: menu.id },
      data: { slotsUpdatedAt: new Date() },
    }),
  ])
}

/**
 * Replaces a whole week's slots in one transaction.
 *
 * Written for the generated proposal, which arrives as a whole week at once.
 * One `setSlot` call per slot would not be atomic, and a failure halfway
 * leaves a half-filled week — which the caller then cannot tell apart from a
 * week somebody built by hand.
 *
 * Every existing slot of the week is removed first, including free-text ones:
 * a proposal replaces the week rather than merging into it, and the caller is
 * responsible for having asked before calling this.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @param slots The slots to write; an empty array clears the week.
 * @returns Nothing.
 * @throws UnknownRecipeError When a recipe was deleted between the proposal and the write.
 */
export async function replaceWeekSlots(
  weekStart: Date,
  slots: readonly {
    day: number
    meal: Meal
    course: Course
    recipeId: string
  }[]
): Promise<void> {
  const menu = await db.menu.upsert({
    where: { weekStart },
    create: { weekStart },
    update: { slotsUpdatedAt: new Date() },
    select: { id: true },
  })

  try {
    await db.$transaction([
      db.menuSlot.deleteMany({ where: { menuId: menu.id } }),
      db.menuSlot.createMany({
        data: slots.map((slot) => ({
          menuId: menu.id,
          day: slot.day,
          meal: slot.meal,
          course: slot.course,
          recipeId: slot.recipeId,
        })),
      }),
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
 * @returns True when no slot of the week carries a recipe or free text.
 */
export async function isWeekEmpty(weekStart: Date): Promise<boolean> {
  const filled = await db.menuSlot.count({
    where: {
      menu: { weekStart },
      OR: [{ recipeId: { not: null } }, { freeText: { not: null } }],
    },
  })

  return filled === 0
}
