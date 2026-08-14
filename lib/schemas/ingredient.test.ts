import { describe, expect, it } from "vitest"

import {
  IngredientNameSchema,
  RecipeIngredientRowSchema,
} from "@/lib/schemas/ingredient"

describe("IngredientNameSchema", () => {
  it("trims surrounding whitespace", () => {
    expect(IngredientNameSchema.parse("  farina 00  ")).toBe("farina 00")
  })

  it("rejects a name that is only whitespace", () => {
    expect(IngredientNameSchema.safeParse("   ").success).toBe(false)
  })

  it("reports in Italian", () => {
    const result = IngredientNameSchema.safeParse("")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Il nome dell’ingrediente non può essere vuoto."
      )
    }
  })
})

describe("RecipeIngredientRowSchema", () => {
  it("keeps a quantity and a unit", () => {
    expect(
      RecipeIngredientRowSchema.parse({
        ingredientName: "spaghetti",
        unit: "g",
        quantity: 320,
      })
    ).toEqual({ ingredientName: "spaghetti", unit: "g", quantity: 320 })
  })

  it("turns an empty unit into null, so it is absent rather than blank", () => {
    expect(
      RecipeIngredientRowSchema.parse({
        ingredientName: "uova",
        unit: "  ",
        quantity: 2,
      }).unit
    ).toBeNull()
  })

  it("accepts a row with no quantity — the q.b. case", () => {
    expect(
      RecipeIngredientRowSchema.parse({
        ingredientName: "sale",
        unit: null,
        quantity: null,
      }).quantity
    ).toBeNull()
  })

  it("rejects a negative quantity", () => {
    expect(
      RecipeIngredientRowSchema.safeParse({
        ingredientName: "spaghetti",
        unit: "g",
        quantity: -1,
      }).success
    ).toBe(false)
  })

  it("rejects a zero quantity, which would ask for nothing", () => {
    expect(
      RecipeIngredientRowSchema.safeParse({
        ingredientName: "spaghetti",
        unit: "g",
        quantity: 0,
      }).success
    ).toBe(false)
  })

  it("rejects a row with no ingredient", () => {
    expect(
      RecipeIngredientRowSchema.safeParse({
        ingredientName: "",
        unit: "g",
        quantity: 1,
      }).success
    ).toBe(false)
  })
})
