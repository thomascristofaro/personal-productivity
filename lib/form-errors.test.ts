// lib/form-errors.test.ts
import { describe, expect, it } from "vitest"

import { fieldErrorsFrom, valuesFrom } from "@/lib/form-errors"
import { CatalogItemInputSchema } from "@/lib/schemas/catalog"
import { RecipeInputSchema } from "@/lib/schemas/recipe"

describe("fieldErrorsFrom", () => {
  it("keys each message under its own field", () => {
    const parsed = CatalogItemInputSchema.safeParse({
      name: "",
      kind: "INGREDIENT",
      defaultUnit: "",
      aisle: "",
    })

    expect(parsed.success).toBe(false)
    if (parsed.success) return

    const errors = fieldErrorsFrom(parsed.error)

    expect(errors.name).toEqual(["Il nome non può essere vuoto."])
    expect(errors.aisle).toEqual(["Scegli un reparto."])
  })

  it("keys a nested issue under the first segment of its path", () => {
    const parsed = RecipeInputSchema.safeParse({
      title: "Prova",
      sourceUrl: "",
      servings: undefined,
      totalMinutes: undefined,
      instructions: "",
      notes: "",
      tags: [],
      ingredients: [{ ingredientName: "", unit: null, quantity: null }],
    })

    expect(parsed.success).toBe(false)
    if (parsed.success) return

    // The recipe form renders one message for the whole ingredient block, so
    // an issue at ["ingredients", 0, "ingredientName"] has to land on
    // "ingredients" or nothing shows it.
    expect(fieldErrorsFrom(parsed.error).ingredients).toHaveLength(1)
  })

  it("drops an issue that names no field", () => {
    // A server action is a public endpoint: it can be called with anything,
    // and a non-object produces an issue whose path is empty.
    const parsed = CatalogItemInputSchema.safeParse(null)

    expect(parsed.success).toBe(false)
    if (parsed.success) return

    expect(fieldErrorsFrom(parsed.error)).toEqual({})
  })
})

describe("valuesFrom", () => {
  it("reads every named field as a string", () => {
    const data = new FormData()
    data.set("name", "pomodori")
    data.set("aisle", "ortofrutta")

    expect(valuesFrom(data, ["name", "aisle"])).toEqual({
      name: "pomodori",
      aisle: "ortofrutta",
    })
  })

  it("gives an absent field an empty string", () => {
    expect(valuesFrom(new FormData(), ["name"])).toEqual({ name: "" })
  })

  it("gives a non-string entry an empty string", () => {
    const data = new FormData()
    data.set("name", new File(["x"], "x.txt"))

    expect(valuesFrom(data, ["name"])).toEqual({ name: "" })
  })
})
