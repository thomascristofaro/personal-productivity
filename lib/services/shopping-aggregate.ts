import { aisleRank } from "@/lib/aisles"
import { HOUSEHOLD_SERVINGS } from "@/lib/config"

// `name` is a foreign key into the ingredient catalogue, not typed text, so two
// lines carrying the same name are the same ingredient by construction. `aisle`
// travels with it: there is no lookup table to consult any more.
export type AggregatorIngredient = {
  name: string
  aisle: string
  quantity: number | null
  unit: string | null
}

export type AggregatorSlot = {
  // 0 Monday through 6 Sunday. Every line the slot contributes to says so.
  day: number
  servings: number | null
  recipe: {
    servings: number | null
    ingredients: AggregatorIngredient[]
  } | null
}

export type ShoppingItem = {
  name: string
  quantity: number | null
  unit: string | null
  aisle: string
  checked: boolean
  checkedById: string | null
  checkedAt: Date | null
  manual: boolean
  // Ascending, and empty on a hand-added line.
  days: number[]
}

// A null unit alongside a quantity means a count of whole things — "2 uova".
const COUNTABLE_UNITS = new Set([
  "pz",
  "spicchio",
  "fetta",
  "foglia",
  "rametto",
  "barattolo",
  "lattina",
  "confezione",
  "bustina",
  "mazzetto",
])

// JSON rather than string concatenation, so a name containing the separator
// cannot forge another line's key, and a null unit stays distinct from "".
const itemKey = (name: string, unit: string | null) =>
  JSON.stringify([name, unit])

const isCountable = (unit: string | null) =>
  unit === null || COUNTABLE_UNITS.has(unit)

// Half an egg left over costs nothing; an egg missing is found at the stove.
// Rounding a weight would instead misstate what the recipe asked for, so weights
// only lose the floating-point noise that scaling introduces.
// Ceiling is rounded to a fixed precision first, or scaling's floating-point
// noise (21 * (9 / 7) === 27.000000000000004) ceils to one unit too many.
const round = (quantity: number, unit: string | null) =>
  isCountable(unit)
    ? Math.ceil(Math.round(quantity * 1e6) / 1e6)
    : Math.round(quantity * 100) / 100

const scaleFactor = (slot: AggregatorSlot) =>
  (slot.servings ?? HOUSEHOLD_SERVINGS) /
  (slot.recipe?.servings ?? HOUSEHOLD_SERVINGS)

type Total = {
  name: string
  aisle: string
  unit: string | null
  quantity: number | null
  days: number[]
}

// Mutates in place and returns the same object: the map's value never escapes
// this module until the map is spread, so there is nothing to copy for.
const noteDay = (total: Total, day: number) => {
  if (!total.days.includes(day)) total.days.push(day)
  return total
}

function totalsFor(slots: AggregatorSlot[]): Total[] {
  const totals = new Map<string, Total>()

  for (const slot of slots) {
    if (slot.recipe === null) continue

    const factor = scaleFactor(slot)

    for (const ingredient of slot.recipe.ingredients) {
      // An unquantified ingredient has no unit either, so "olio q.b." from two
      // recipes lands on one key and stays one line.
      const unit = ingredient.quantity === null ? null : ingredient.unit
      const key = itemKey(ingredient.name, unit)
      const current = totals.get(key)

      if (ingredient.quantity === null) {
        if (current === undefined) {
          totals.set(key, {
            name: ingredient.name,
            aisle: ingredient.aisle,
            unit: null,
            quantity: null,
            days: [slot.day],
          })
          continue
        }
        // An unquantified line still answers "when do I need this", so a second
        // slot asking for it adds its day even though it adds no quantity.
        noteDay(current, slot.day)
        continue
      }

      totals.set(
        key,
        noteDay(
          {
            name: ingredient.name,
            aisle: ingredient.aisle,
            unit,
            quantity: (current?.quantity ?? 0) + ingredient.quantity * factor,
            days: current?.days ?? [],
          },
          slot.day
        )
      )
    }
  }

  return [...totals.values()]
}

/**
 * Builds the shopping list for a menu, from the recipes its slots point at.
 *
 * Pure and deterministic: it reads no database and holds no state, so a caller
 * loads the slots and the previous list, and writes back whatever comes out.
 * Each ingredient carries its own aisle from the catalogue, so there is no
 * lookup to pass in. Slots with no recipe — free text, or empty — contribute
 * nothing. Items added by hand and the checked state of surviving items outlive
 * a regeneration, which is what makes editing the menu safe.
 *
 * @param input Every slot of the menu including the ones with no recipe, and
 *   the current list or an empty array on first generation.
 * @param input.slots Every slot of the menu, including the ones with no recipe.
 * @param input.existing The current list, or an empty array on first generation.
 * @returns The new list, sorted by supermarket walking order and then by name.
 */
export function aggregateShoppingList(input: {
  slots: AggregatorSlot[]
  existing: ShoppingItem[]
}): ShoppingItem[] {
  const { slots, existing } = input

  const previous = new Map(
    existing
      .filter((line) => !line.manual)
      .map((line) => [itemKey(line.name, line.unit), line])
  )

  const generated = totalsFor(slots).map<ShoppingItem>((total) => {
    const prior = previous.get(itemKey(total.name, total.unit))
    const quantity =
      total.quantity === null ? null : round(total.quantity, total.unit)

    // A tick means "I have enough of this". If the list now asks for more than
    // it did before, that stops being true, so the tick — and who and when —
    // does not survive. A lower or unquantified either side still means what
    // it meant, so those keep the tick.
    const quantityRose =
      prior !== undefined &&
      prior.quantity !== null &&
      quantity !== null &&
      quantity > prior.quantity

    return {
      name: total.name,
      quantity,
      unit: total.unit,
      aisle: total.aisle,
      checked: quantityRose ? false : (prior?.checked ?? false),
      checkedById: quantityRose ? null : (prior?.checkedById ?? null),
      checkedAt: quantityRose ? null : (prior?.checkedAt ?? null),
      manual: false,
      // Not carried across from `prior` the way the tick is: the days are a
      // fact about the menu as it stands now, so a slot moved from Monday to
      // Friday must move the line with it.
      days: [...total.days].sort((a, b) => a - b),
    }
  })

  const manual = existing.filter((line) => line.manual)

  return [...generated, ...manual].sort(
    (a, b) =>
      aisleRank(a.aisle) - aisleRank(b.aisle) ||
      a.name.localeCompare(b.name, "it")
  )
}
