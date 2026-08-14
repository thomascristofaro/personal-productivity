import { describe, expect, it } from "vitest"

import { RECIPE_NOTES_MAX, RecipeInputSchema } from "@/lib/schemas/recipe"

const valid = {
  title: "Spaghetti al pomodoro",
  sourceUrl: "",
  servings: 4,
  totalMinutes: 25,
  instructions: "Bollire l'acqua.\nCuocere la pasta.",
  notes: "",
  tags: ["veloce", "vegetariano"],
  ingredients: [
    { ingredientName: "spaghetti", unit: "g", quantity: 320 },
    { ingredientName: "pomodori pelati", unit: "g", quantity: 400 },
  ],
}

const parse = (overrides: Record<string, unknown>) =>
  RecipeInputSchema.safeParse({ ...valid, ...overrides })

describe("RecipeInputSchema", () => {
  it("accepts a complete recipe", () => {
    expect(parse({}).success).toBe(true)
  })

  it("rejects an empty title, because a recipe with no name cannot be found again", () => {
    expect(parse({ title: "   " }).success).toBe(false)
  })

  it("trims the title rather than storing the user's stray spaces", () => {
    const result = parse({ title: "  Carbonara  " })
    expect(result.success && result.data.title).toBe("Carbonara")
  })

  it("rejects zero servings, because the shopping list divides by it", () => {
    expect(parse({ servings: 0 }).success).toBe(false)
  })

  it("rejects negative servings", () => {
    expect(parse({ servings: -2 }).success).toBe(false)
  })

  it("rejects fractional servings", () => {
    expect(parse({ servings: 1.5 }).success).toBe(false)
  })

  it("allows servings to be absent, because not every source states a yield", () => {
    const result = parse({ servings: undefined })
    expect(result.success && result.data.servings).toBeUndefined()
  })

  it("rejects zero total minutes but allows it to be absent", () => {
    expect(parse({ totalMinutes: 0 }).success).toBe(false)
    expect(parse({ totalMinutes: undefined }).success).toBe(true)
  })

  it("rejects a recipe with no ingredients", () => {
    const result = parse({ ingredients: [] })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Serve almeno un ingrediente."
      )
    }
  })

  it("rejects a row that names no ingredient", () => {
    expect(
      parse({
        ingredients: [{ ingredientName: "", unit: "g", quantity: 1 }],
      }).success
    ).toBe(false)
  })

  it("rejects a blank tag", () => {
    expect(parse({ tags: ["veloce", " "] }).success).toBe(false)
  })

  it("accepts an empty source URL, because a dictated recipe has none", () => {
    expect(parse({ sourceUrl: "" }).success).toBe(true)
  })

  it("rejects a source URL that is not http or https", () => {
    expect(parse({ sourceUrl: "javascript:alert(1)" }).success).toBe(false)
  })

  it("accepts an https source URL", () => {
    expect(parse({ sourceUrl: "https://example.com/ricetta" }).success).toBe(
      true
    )
  })

  it("rejects a source URL longer than the practical limit for a URL", () => {
    const url = "https://example.com/" + "a".repeat(2000)
    expect(parse({ sourceUrl: url }).success).toBe(false)
  })

  it("accepts a source URL comfortably under the limit", () => {
    const url = "https://example.com/" + "a".repeat(100)
    expect(parse({ sourceUrl: url }).success).toBe(true)
  })

  it("accepts a source URL with an uppercase scheme", () => {
    expect(parse({ sourceUrl: "HTTPS://example.com/ricetta" }).success).toBe(
      true
    )
  })

  it("rejects a title longer than the column is meant to hold", () => {
    expect(parse({ title: "a".repeat(201) }).success).toBe(false)
  })

  it("reports an empty title in Italian", () => {
    const result = parse({ title: "" })
    expect(!result.success && result.error.issues[0]?.message).toBe(
      "Il nome non può essere vuoto."
    )
  })

  it("reports zero servings in Italian", () => {
    const result = parse({ servings: 0 })
    expect(!result.success && result.error.issues[0]?.message).toBe(
      "Le porzioni devono essere maggiori di zero."
    )
  })

  it("reports a malformed source URL in Italian", () => {
    const result = parse({ sourceUrl: "non è un indirizzo" })
    expect(!result.success && result.error.issues[0]?.message).toBe(
      "L'indirizzo deve essere un URL valido."
    )
  })

  it("reports an over-long note in Italian", () => {
    const result = parse({ notes: "a".repeat(RECIPE_NOTES_MAX + 1) })
    expect(!result.success && result.error.issues[0]?.message).toBe(
      `Le note possono avere al massimo ${RECIPE_NOTES_MAX} caratteri.`
    )
  })
})
