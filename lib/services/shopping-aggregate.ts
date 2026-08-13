import { AISLE_UNKNOWN, aisleRank } from "@/lib/aisles"
import { HOUSEHOLD_SERVINGS } from "@/lib/config"

export type AggregatorIngredient = {
  name: string
  quantity: number | null
  unit: string | null
}

export type AggregatorSlot = {
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
const round = (quantity: number, unit: string | null) =>
  isCountable(unit) ? Math.ceil(quantity) : Math.round(quantity * 100) / 100

const scaleFactor = (slot: AggregatorSlot) =>
  (slot.servings ?? HOUSEHOLD_SERVINGS) /
  (slot.recipe?.servings ?? HOUSEHOLD_SERVINGS)

type Total = { name: string; unit: string | null; quantity: number | null }

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
          totals.set(key, { name: ingredient.name, unit: null, quantity: null })
        }
        continue
      }

      totals.set(key, {
        name: ingredient.name,
        unit,
        quantity: (current?.quantity ?? 0) + ingredient.quantity * factor,
      })
    }
  }

  return [...totals.values()]
}

/**
 * Builds the shopping list for a menu, from the recipes its slots point at.
 *
 * Pure and deterministic: it reads no database and holds no state, so a caller
 * loads the slots, the previous list and the learned aisles, and writes back
 * whatever comes out. Slots with no recipe — free text, or empty — contribute
 * nothing. Items added by hand and the checked state of surviving items outlive
 * a regeneration, which is what makes editing the menu safe.
 *
 * @param input Every slot of the menu including the ones with no recipe, the
 *   current list or an empty array on first generation, and the learned aisles
 *   keyed by normalised ingredient name.
 * @param input.slots Every slot of the menu, including the ones with no recipe.
 * @param input.existing The current list, or an empty array on first generation.
 * @param input.aisles The learned aisles, keyed by normalised ingredient name.
 * @returns The new list, sorted by supermarket walking order and then by name.
 */
export function aggregateShoppingList(input: {
  slots: AggregatorSlot[]
  existing: ShoppingItem[]
  aisles: Record<string, string>
}): ShoppingItem[] {
  const { slots, existing, aisles } = input

  const previous = new Map(
    existing
      .filter((line) => !line.manual)
      .map((line) => [itemKey(line.name, line.unit), line])
  )

  const generated = totalsFor(slots).map<ShoppingItem>((total) => {
    const prior = previous.get(itemKey(total.name, total.unit))

    return {
      name: total.name,
      quantity:
        total.quantity === null ? null : round(total.quantity, total.unit),
      unit: total.unit,
      aisle: aisles[total.name] ?? AISLE_UNKNOWN,
      checked: prior?.checked ?? false,
      checkedById: prior?.checkedById ?? null,
      checkedAt: prior?.checkedAt ?? null,
      manual: false,
    }
  })

  const manual = existing.filter((line) => line.manual)

  return [...generated, ...manual].sort(
    (a, b) =>
      aisleRank(a.aisle) - aisleRank(b.aisle) ||
      a.name.localeCompare(b.name, "it")
  )
}
