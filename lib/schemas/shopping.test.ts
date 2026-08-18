import { describe, expect, it } from "vitest"

import {
  AddShoppingItemSchema,
  ManualItemSchema,
  ShoppingItemIdSchema,
  ShoppingItemIdsSchema,
} from "@/lib/schemas/shopping"

describe("ShoppingItemIdSchema", () => {
  it("accepts a cuid", () => {
    expect(ShoppingItemIdSchema.parse("cm3xk1p2h0000abcdefghijkl")).toBe(
      "cm3xk1p2h0000abcdefghijkl"
    )
  })

  it("rejects anything else", () => {
    expect(ShoppingItemIdSchema.safeParse("42").success).toBe(false)
  })
})

describe("ShoppingItemIdsSchema", () => {
  const id = "cm3xk1p2h0000abcdefghijkl"

  it("takes the several ids one merged line stands for", () => {
    expect(ShoppingItemIdsSchema.parse([id, id])).toEqual([id, id])
  })

  it("refuses an empty list, which would tick nothing and report success", () => {
    expect(ShoppingItemIdsSchema.safeParse([]).success).toBe(false)
  })

  it("refuses anything that is not an id", () => {
    expect(ShoppingItemIdsSchema.safeParse(["1 OR 1=1"]).success).toBe(false)
  })

  it("caps the count, so a forged post cannot tick the whole list at once", () => {
    expect(
      ShoppingItemIdsSchema.safeParse(Array.from({ length: 21 }, () => id))
        .success
    ).toBe(false)
  })
})

describe("ManualItemSchema", () => {
  const valid = {
    name: "detersivo",
    aisle: "casa e pulizia",
    quantity: null,
    unit: null,
  }

  it("accepts a bare name and an aisle", () => {
    expect(ManualItemSchema.parse(valid)).toEqual(valid)
  })

  it("accepts a quantity with its unit", () => {
    expect(
      ManualItemSchema.parse({ ...valid, quantity: 2, unit: "pz" })
    ).toMatchObject({ quantity: 2, unit: "pz" })
  })

  it("trims the name", () => {
    expect(
      ManualItemSchema.parse({ ...valid, name: "  sacchetti " }).name
    ).toBe("sacchetti")
  })

  it("lowercases the name, so it merges with a generated line", () => {
    expect(
      ManualItemSchema.parse({
        ...valid,
        name: "Pomodori",
        quantity: 200,
        unit: "g",
      }).name
    ).toBe("pomodori")
  })

  it("rejects an empty name", () => {
    const result = ManualItemSchema.safeParse({ ...valid, name: "   " })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Scrivi che cosa serve.")
    }
  })

  it("rejects an empty aisle, because the list is sorted by it", () => {
    expect(ManualItemSchema.safeParse({ ...valid, aisle: "" }).success).toBe(
      false
    )
  })

  it("turns a blank unit into null, so it is absent rather than empty", () => {
    expect(ManualItemSchema.parse({ ...valid, unit: "  " }).unit).toBeNull()
  })

  it("rejects a quantity of zero, which would ask for nothing", () => {
    expect(ManualItemSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(
      false
    )
  })

  it("rejects a negative quantity", () => {
    expect(ManualItemSchema.safeParse({ ...valid, quantity: -1 }).success).toBe(
      false
    )
  })
})

describe("AddShoppingItemSchema", () => {
  const base = {
    name: "shampoo",
    aisle: "casa e pulizia",
    quantity: null,
    unit: null,
  }

  it("takes both flags", () => {
    expect(
      AddShoppingItemSchema.parse({ ...base, remember: true, kind: "PRODUCT" })
    ).toEqual({ ...base, remember: true, kind: "PRODUCT" })
  })

  it("has no default for remember: what a missing checkbox means is the action's call", () => {
    expect(
      AddShoppingItemSchema.safeParse({ ...base, kind: "PRODUCT" }).success
    ).toBe(false)
  })

  it("still lowercases the name", () => {
    expect(
      AddShoppingItemSchema.parse({
        ...base,
        name: "Shampoo",
        remember: false,
        kind: "PRODUCT",
      }).name
    ).toBe("shampoo")
  })

  it("rejects a kind nobody defined", () => {
    expect(
      AddShoppingItemSchema.safeParse({
        ...base,
        remember: true,
        kind: "HOUSEHOLD",
      }).success
    ).toBe(false)
  })
})
