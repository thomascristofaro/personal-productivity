import { DAYS_IN_WEEK } from "@/lib/config"
import { db } from "@/lib/db"
import { MEAL_TYPES, type Meal, type SlotInput } from "@/lib/schemas/menu"

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

const keyOf = (day: number, meal: Meal) => `${day}-${meal}`

/**
 * Expands the stored slots into the fourteen the screen always shows.
 *
 * Exported for its own test: the database holds only the slots that have
 * content, so this is where a sparse week becomes a dense grid, and it is the
 * one piece of logic here that needs no database.
 *
 * @param stored The slots that exist, in any order.
 * @returns Fourteen slots, day 0 to 6, lunch before dinner.
 */
export function buildWeekSlots(
  stored: readonly MenuSlotView[]
): MenuSlotView[] {
  const byKey = new Map(
    stored.map((slot) => [keyOf(slot.day, slot.meal), slot])
  )

  return Array.from({ length: DAYS_IN_WEEK }, (_, day) =>
    MEAL_TYPES.map(
      (meal): MenuSlotView =>
        byKey.get(keyOf(day, meal)) ?? {
          day,
          meal,
          recipeId: null,
          recipeTitle: null,
          freeText: null,
          servings: null,
        }
    )
  ).flat()
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
 * Reads one week as fourteen slots.
 *
 * A week nobody has touched has no `Menu` row at all; it comes back as fourteen
 * empty slots rather than as an error, because an empty week is a normal state.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @returns Fourteen slots, day 0 to 6, lunch before dinner.
 */
export async function getMenuWeek(weekStart: Date): Promise<MenuSlotView[]> {
  const menu = await db.menu.findUnique({
    where: { weekStart },
    select: {
      slots: {
        select: {
          day: true,
          meal: true,
          recipeId: true,
          freeText: true,
          servings: true,
          recipe: { select: { title: true } },
        },
      },
    },
  })

  return buildWeekSlots(
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
 * @param day 0 for Monday through 6 for Sunday.
 * @param meal Which of the day's two meals.
 * @param input The validated slot contents.
 * @returns Nothing.
 * @throws UnknownRecipeError When the recipe was deleted between the picker and the save.
 */
export async function setSlot(
  weekStart: Date,
  day: number,
  meal: Meal,
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
    return clearSlot(weekStart, day, meal)
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
      where: { menuId_day_meal: { menuId: menu.id, day, meal } },
      create: { menuId: menu.id, day, meal, ...input },
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
 * slot must mean the same thing, and `buildWeekSlots` already makes them look
 * identical on screen. Uses `deleteMany` so clearing an already-empty slot is
 * not an error.
 *
 * @param weekStart The Monday naming the week, at UTC midnight.
 * @param day 0 for Monday through 6 for Sunday.
 * @param meal Which of the day's two meals.
 * @returns Nothing.
 */
export async function clearSlot(
  weekStart: Date,
  day: number,
  meal: Meal
): Promise<void> {
  const menu = await db.menu.findUnique({
    where: { weekStart },
    select: { id: true },
  })

  if (menu === null) return

  // One transaction: a delete that landed without its touch would leave the
  // shopping list claiming to be current while an item had just left the menu.
  await db.$transaction([
    db.menuSlot.deleteMany({ where: { menuId: menu.id, day, meal } }),
    db.menu.update({
      where: { id: menu.id },
      data: { slotsUpdatedAt: new Date() },
    }),
  ])
}
