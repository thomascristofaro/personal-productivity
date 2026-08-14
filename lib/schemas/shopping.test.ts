import { describe, expect, it } from "vitest"

import { ManualItemSchema, ShoppingItemIdSchema } from "@/lib/schemas/shopping"

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
