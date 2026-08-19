import { describe, expect, it } from "vitest"

import { AISLE_UNKNOWN } from "@/lib/aisles"
import {
  type AggregatorIngredient,
  type AggregatorSlot,
  type PurchasedTotal,
  type ShoppingItem,
  aggregateShoppingList,
} from "@/lib/services/shopping-aggregate"

// What the catalogue says, standing in for Ingredient.aisle. A name missing
// here is an ingredient nobody has classified, which lands in the catch-all.
const AISLES: Record<string, string> = {
  spaghetti: "dispensa",
  pomodori: "ortofrutta",
  uova: "banco frigo",
  patate: "ortofrutta",
}

// The aisle is filled in from AISLES unless a test states one, so the fixtures
// stay about quantities and units — which is what these tests are checking.
type IngredientFixture = Omit<AggregatorIngredient, "aisle"> & {
  aisle?: string
}

const slot = (
  ingredients: IngredientFixture[],
  options: {
    recipeServings?: number | null
    slotServings?: number | null
    day?: number
  } = {}
): AggregatorSlot => ({
  // Monday unless a test says otherwise, so every case written before days
  // existed keeps meaning what it meant.
  day: options.day ?? 0,
  servings: options.slotServings ?? null,
  recipe: {
    servings: options.recipeServings ?? 2,
    ingredients: ingredients.map((ingredient) => ({
      ...ingredient,
      aisle: ingredient.aisle ?? AISLES[ingredient.name] ?? AISLE_UNKNOWN,
    })),
  },
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
  days: [],
  takenQuantity: null,
  dismissed: false,
  ...overrides,
})

const aggregate = (
  slots: AggregatorSlot[],
  existing: ShoppingItem[] = [],
  purchased: PurchasedTotal[] = []
) => aggregateShoppingList({ slots, existing, purchased })

describe("aggregateShoppingList", () => {
  it("carries each ingredient's own aisle onto its line", () => {
    const result = aggregate([
      slot([
        { name: "spaghetti", quantity: 320, unit: "g" },
        { name: "pomodori", quantity: 400, unit: "g" },
      ]),
    ])

    // Sorted by walking order: ortofrutta comes before dispensa.
    expect(result.map((line) => line.aisle)).toEqual(["ortofrutta", "dispensa"])
  })

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
      { day: 1, servings: null, recipe: null },
      slot([{ name: "spaghetti", quantity: 100, unit: "g" }]),
      { day: 2, servings: null, recipe: null },
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

  it("rounds a countable up even when rounding to nearest would round it down", () => {
    const result = aggregate([
      slot([{ name: "uova", quantity: 2, unit: null }], { recipeServings: 10 }),
    ])

    // 2 * (2 / 10) = 0.4: Math.round would give 0, Math.ceil must give 1.
    expect(result[0].quantity).toBe(1)
  })

  it("rounds a named countable unit up even when rounding to nearest would round it down", () => {
    const result = aggregate([
      slot([{ name: "pomodori", quantity: 1, unit: "confezione" }], {
        recipeServings: 10,
      }),
    ])

    // 1 * (2 / 10) = 0.2: Math.round would give 0, Math.ceil must give 1.
    expect(result[0].quantity).toBe(1)
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

  it("unchecks an item whose quantity has risen since the previous list", () => {
    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 200, unit: "g" }])],
      [
        item({
          name: "spaghetti",
          unit: "g",
          quantity: 100,
          aisle: "dispensa",
          checked: true,
          checkedById: "user-1",
          checkedAt: new Date("2026-08-13T10:00:00Z"),
        }),
      ]
    )

    expect(result[0]).toMatchObject({
      quantity: 200,
      checked: false,
      checkedById: null,
      checkedAt: null,
    })
  })

  it("keeps the checked state of an item whose quantity has fallen since the previous list", () => {
    const checkedAt = new Date("2026-08-13T10:00:00Z")

    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 100, unit: "g" }])],
      [
        item({
          name: "spaghetti",
          unit: "g",
          quantity: 200,
          aisle: "dispensa",
          checked: true,
          checkedById: "user-1",
          checkedAt,
        }),
      ]
    )

    expect(result[0]).toMatchObject({
      quantity: 100,
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

describe("the days a line is needed for", () => {
  it("carries the day of the slot that asked for it", () => {
    const result = aggregate([
      slot([{ name: "spaghetti", quantity: 320, unit: "g" }], { day: 2 }),
    ])

    expect(result[0].days).toEqual([2])
  })

  it("collects every day, in order, when several slots ask for the same thing", () => {
    const result = aggregate([
      slot([{ name: "spaghetti", quantity: 320, unit: "g" }], { day: 4 }),
      slot([{ name: "spaghetti", quantity: 100, unit: "g" }], { day: 1 }),
    ])

    expect(result[0].days).toEqual([1, 4])
  })

  it("lists a day once, however many meals of it ask", () => {
    const result = aggregate([
      slot([{ name: "spaghetti", quantity: 320, unit: "g" }], { day: 3 }),
      slot([{ name: "spaghetti", quantity: 100, unit: "g" }], { day: 3 }),
    ])

    expect(result[0].days).toEqual([3])
  })

  it("collects the days of an unquantified line too", () => {
    const result = aggregate([
      slot([{ name: "sale", quantity: null, unit: null }], { day: 5 }),
      slot([{ name: "sale", quantity: null, unit: null }], { day: 2 }),
    ])

    expect(result[0].days).toEqual([2, 5])
  })

  it("leaves a line added by hand with no days, because no menu asked for it", () => {
    const result = aggregate(
      [],
      [item({ name: "sacchetti", manual: true, aisle: AISLE_UNKNOWN })]
    )

    expect(result[0].days).toEqual([])
  })

  it("recomputes the days rather than carrying the previous ones across", () => {
    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 320, unit: "g" }], { day: 6 })],
      [item({ name: "spaghetti", quantity: 320, unit: "g", days: [0, 1, 2] })]
    )

    expect(result[0].days).toEqual([6])
  })
})

describe("what has already been bought", () => {
  const bought = (over: Partial<PurchasedTotal> = {}): PurchasedTotal => ({
    name: "spaghetti",
    unit: "g",
    quantity: 320,
    ...over,
  })

  it("drops a line whose whole quantity has been bought", () => {
    expect(
      aggregate(
        [slot([{ name: "spaghetti", quantity: 320, unit: "g" }])],
        [],
        [bought()]
      )
    ).toEqual([])
  })

  it("leaves the remainder when the menu now asks for more", () => {
    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 500, unit: "g" }])],
      [],
      [bought({ quantity: 300 })]
    )

    expect(result).toHaveLength(1)
    expect(result[0].quantity).toBe(200)
  })

  it("drops a line bought more than once, summing the trips", () => {
    expect(
      aggregate(
        [slot([{ name: "spaghetti", quantity: 500, unit: "g" }])],
        [],
        [bought({ quantity: 300 }), bought({ quantity: 200 })]
      )
    ).toEqual([])
  })

  it("drops an unquantified line once anything of it has been bought", () => {
    expect(
      aggregate(
        [slot([{ name: "spaghetti", quantity: null, unit: null }])],
        [],
        [bought({ unit: null, quantity: null })]
      )
    ).toEqual([])
  })

  it("treats a purchase with no quantity as satisfying the whole line", () => {
    expect(
      aggregate(
        [slot([{ name: "spaghetti", quantity: 500, unit: "g" }])],
        [],
        [bought({ quantity: null })]
      )
    ).toEqual([])
  })

  it("subtracts nothing across two different units", () => {
    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 500, unit: "g" }])],
      [],
      [bought({ unit: "confezione", quantity: 2 })]
    )

    expect(result[0].quantity).toBe(500)
  })

  it("subtracts nothing for a name the menu no longer asks for", () => {
    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 500, unit: "g" }])],
      [],
      [bought({ name: "pomodori", quantity: 400 })]
    )

    expect(result).toHaveLength(1)
    expect(result[0].quantity).toBe(500)
  })

  // Not a special case in the code, and that is the point: a hand-added row is
  // never regenerated, so there is nothing for the subtraction to reach.
  it("leaves a line added by hand alone, whatever has been bought", () => {
    expect(
      aggregate(
        [],
        [item({ name: "spaghetti", quantity: 320, unit: "g", manual: true })],
        [bought()]
      )
    ).toHaveLength(1)
  })

  it("rounds a countable remainder up, never to a fraction of a thing", () => {
    // Six eggs less four and a half is one and a half eggs, and no shop sells
    // half an egg.
    const result = aggregate(
      [slot([{ name: "uova", quantity: 6, unit: null }])],
      [],
      [{ name: "uova", unit: null, quantity: 4.5 }]
    )

    expect(result[0].quantity).toBe(2)
  })

  it("keeps the tick of a line that survives the subtraction", () => {
    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 500, unit: "g" }])],
      [item({ name: "spaghetti", quantity: 500, unit: "g", checked: true })],
      [bought({ quantity: 300 })]
    )

    expect(result[0].checked).toBe(true)
  })
})

// Two decisions the shopper makes on the line itself, which the menu knows
// nothing about: how much of it is going in the trolley, and that it is not
// being bought at all. Both have to outlive a regeneration or the bin and the
// pencil would be undone by the next tap on "Rigenera".
describe("what the shopper decided about a line", () => {
  it("carries the taken quantity across a regeneration", () => {
    const result = aggregate(
      [slot([{ name: "uova", quantity: 6, unit: null }])],
      [item({ name: "uova", quantity: 6, unit: null, takenQuantity: 4 })]
    )

    expect(result[0].takenQuantity).toBe(4)
  })

  it("keeps the taken quantity even when the menu asks for more", () => {
    // The tick falls, because "I have enough" stopped being true. How many the
    // shopper decided to put in the trolley did not: it is a decision about the
    // trolley, not an answer to the menu.
    const result = aggregate(
      [slot([{ name: "uova", quantity: 12, unit: null }])],
      [
        item({
          name: "uova",
          quantity: 6,
          unit: null,
          checked: true,
          takenQuantity: 4,
        }),
      ]
    )

    expect(result[0]).toMatchObject({ checked: false, takenQuantity: 4 })
  })

  it("does not resurrect a taken quantity under a different unit", () => {
    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 1, unit: "confezione" }])],
      [
        item({
          name: "spaghetti",
          unit: "g",
          quantity: 500,
          takenQuantity: 300,
        }),
      ]
    )

    expect(result[0].takenQuantity).toBeNull()
  })

  it("keeps a line out of the list across a regeneration once it is dismissed", () => {
    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 500, unit: "g" }])],
      [
        item({
          name: "spaghetti",
          quantity: 500,
          unit: "g",
          dismissed: true,
        }),
      ]
    )

    expect(result[0].dismissed).toBe(true)
  })

  it("puts a dismissed line back when the menu asks for more than it did", () => {
    // "We have this at home" was an answer to 200 g. It is not an answer to 500.
    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 500, unit: "g" }])],
      [
        item({
          name: "spaghetti",
          quantity: 200,
          unit: "g",
          dismissed: true,
        }),
      ]
    )

    expect(result[0].dismissed).toBe(false)
  })

  it("leaves a dismissed line dismissed when the menu asks for less", () => {
    const result = aggregate(
      [slot([{ name: "spaghetti", quantity: 200, unit: "g" }])],
      [
        item({
          name: "spaghetti",
          quantity: 500,
          unit: "g",
          dismissed: true,
        }),
      ]
    )

    expect(result[0].dismissed).toBe(true)
  })
})
