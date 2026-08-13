import { describe, expect, it } from "vitest"

import { AISLE_UNKNOWN } from "@/lib/aisles"
import {
  type AggregatorIngredient,
  type AggregatorSlot,
  type ShoppingItem,
  aggregateShoppingList,
} from "@/lib/services/shopping-aggregate"

const AISLES = {
  spaghetti: "dispensa",
  pomodori: "ortofrutta",
  uova: "banco frigo",
  patate: "ortofrutta",
}

const slot = (
  ingredients: AggregatorIngredient[],
  options: { recipeServings?: number | null; slotServings?: number | null } = {}
): AggregatorSlot => ({
  servings: options.slotServings ?? null,
  recipe: { servings: options.recipeServings ?? 2, ingredients },
})

const item = (overrides: Partial<ShoppingItem>): ShoppingItem => ({
  name: "x",
  quantity: null,
  unit: null,
  aisle: AISLE_UNKNOWN,
  checked: false,
  checkedById: null,
  checkedAt: null,
  manual: false,
  ...overrides,
})

const aggregate = (slots: AggregatorSlot[], existing: ShoppingItem[] = []) =>
  aggregateShoppingList({ slots, existing, aisles: AISLES })

describe("aggregateShoppingList", () => {
  it("sums an ingredient shared by two recipes", () => {
    const result = aggregate([
      slot([{ name: "spaghetti", quantity: 320, unit: "g" }]),
      slot([{ name: "spaghetti", quantity: 180, unit: "g" }]),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: "spaghetti",
      quantity: 500,
      unit: "g",
    })
  })

  it("scales a recipe written for four down to the household default", () => {
    const result = aggregate([
      slot([{ name: "spaghetti", quantity: 320, unit: "g" }], {
        recipeServings: 4,
      }),
    ])

    expect(result[0].quantity).toBe(160)
  })

  it("scales up when the slot overrides the servings", () => {
    const result = aggregate([
      slot([{ name: "spaghetti", quantity: 320, unit: "g" }], {
        recipeServings: 4,
        slotServings: 6,
      }),
    ])

    expect(result[0].quantity).toBe(480)
  })

  it("keeps incompatible units on separate lines instead of coercing them", () => {
    const result = aggregate([
      slot([
        { name: "pomodori", quantity: 200, unit: "g" },
        { name: "pomodori", quantity: 2, unit: null },
      ]),
    ])

    expect(result).toHaveLength(2)
    expect(new Set(result.map((line) => line.unit))).toEqual(
      new Set(["g", null])
    )
  })

  it("collapses unquantified ingredients into one line", () => {
    const result = aggregate([
      slot([{ name: "sale", quantity: null, unit: null }]),
      slot([{ name: "sale", quantity: null, unit: null }]),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: "sale",
      quantity: null,
      unit: null,
    })
  })

  it("excludes free-text and empty slots", () => {
    const result = aggregate([
      { servings: null, recipe: null },
      slot([{ name: "spaghetti", quantity: 100, unit: "g" }]),
      { servings: null, recipe: null },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("spaghetti")
  })

  it("rounds a countable quantity up and leaves a weight exact", () => {
    const result = aggregate([
      slot(
        [
          { name: "uova", quantity: 1, unit: null },
          { name: "patate", quantity: 350, unit: "g" },
        ],
        { recipeServings: 4 }
      ),
    ])

    const byName = new Map(result.map((line) => [line.name, line.quantity]))
    expect(byName.get("uova")).toBe(1)
    expect(byName.get("patate")).toBe(175)
  })

  it("keeps manual items across a regeneration", () => {
    const detersivo = item({
      name: "detersivo",
      manual: true,
      aisle: "casa e pulizia",
    })

    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 100, unit: "g" }])],
      [detersivo]
    )

    expect(result).toContainEqual(detersivo)
  })

  it("keeps the checked state of an item that survives a regeneration", () => {
    const checkedAt = new Date("2026-08-13T10:00:00Z")

    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 100, unit: "g" }])],
      [
        item({
          name: "spaghetti",
          unit: "g",
          quantity: 100,
          aisle: "dispensa",
          checked: true,
          checkedById: "user-1",
          checkedAt,
        }),
      ]
    )

    expect(result[0]).toMatchObject({
      checked: true,
      checkedById: "user-1",
      checkedAt,
    })
  })

  it("does not resurrect the checked state of an item under a different unit", () => {
    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 1, unit: "confezione" }])],
      [item({ name: "spaghetti", unit: "g", checked: true, aisle: "dispensa" })]
    )

    expect(result[0].checked).toBe(false)
  })

  it("sends an ingredient with no learned aisle to the catch-all", () => {
    const result = aggregate([
      slot([{ name: "curcuma", quantity: null, unit: null }]),
    ])

    expect(result[0].aisle).toBe(AISLE_UNKNOWN)
  })

  it("orders the list by aisle, in walking order", () => {
    const result = aggregate([
      slot([
        { name: "spaghetti", quantity: 100, unit: "g" },
        { name: "curcuma", quantity: null, unit: null },
        { name: "pomodori", quantity: 300, unit: "g" },
      ]),
    ])

    expect(result.map((line) => line.name)).toEqual([
      "pomodori",
      "spaghetti",
      "curcuma",
    ])
  })
})
