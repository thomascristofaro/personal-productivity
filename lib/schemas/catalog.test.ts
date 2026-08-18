import { describe, expect, it } from "vitest"

import {
  CatalogItemInputSchema,
  CatalogItemNameSchema,
  RecipeIngredientRowSchema,
} from "@/lib/schemas/catalog"

describe("CatalogItemNameSchema", () => {
  it("trims surrounding whitespace", () => {
    expect(CatalogItemNameSchema.parse("  farina 00  ")).toBe("farina 00")
  })

  it("lowercases, so a typed name matches the catalogue's own", () => {
    expect(CatalogItemNameSchema.parse("Pomodori")).toBe("pomodori")
  })

  it("lowercases every word, not only the first", () => {
    expect(CatalogItemNameSchema.parse("Grana Padano")).toBe("grana padano")
  })

  it("collapses inner whitespace, so two spaces cannot open a second entry", () => {
    expect(CatalogItemNameSchema.parse("cime  di   rapa")).toBe("cime di rapa")
  })

  it("is stable under a second application", () => {
    const once = CatalogItemNameSchema.parse("  Cime  Di Rapa ")
    expect(CatalogItemNameSchema.parse(once)).toBe(once)
  })

  it("rejects a name that is only whitespace", () => {
    expect(CatalogItemNameSchema.safeParse("   ").success).toBe(false)
  })

  it("reports in Italian", () => {
    const result = CatalogItemNameSchema.safeParse("")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Il nome non può essere vuoto."
      )
    }
  })

  it("rejects a name containing a slash, which would break its URL", () => {
    const result = CatalogItemNameSchema.safeParse("olio/burro")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Il nome non può contenere «/»."
      )
    }
  })

  it("still accepts an ordinary name with spaces and accents", () => {
    expect(CatalogItemNameSchema.parse("pasta brisée")).toBe("pasta brisée")
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

  it("lowercases the ingredient name, because it is a foreign key", () => {
    expect(
      RecipeIngredientRowSchema.parse({
        ingredientName: "Spaghetti",
        unit: "g",
        quantity: 320,
      }).ingredientName
    ).toBe("spaghetti")
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
    const result = RecipeIngredientRowSchema.safeParse({
      ingredientName: "",
      unit: "g",
      quantity: 1,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Scegli un ingrediente.")
    }
  })
})

describe("CatalogItemInputSchema", () => {
  const valid = {
    name: "spaghetti",
    kind: "INGREDIENT",
    defaultUnit: "g",
    aisle: "dispensa",
  }

  it("accepts a complete entry", () => {
    expect(CatalogItemInputSchema.parse(valid)).toEqual(valid)
  })

  it("defaults the kind to an ingredient, which is what most entries are", () => {
    expect(
      CatalogItemInputSchema.parse({
        name: "pomodori",
        defaultUnit: "g",
        aisle: "ortofrutta",
      }).kind
    ).toBe("INGREDIENT")
  })

  it("keeps a product", () => {
    expect(
      CatalogItemInputSchema.parse({
        name: "shampoo",
        kind: "PRODUCT",
        defaultUnit: null,
        aisle: "casa e pulizia",
      })
    ).toEqual({
      name: "shampoo",
      kind: "PRODUCT",
      defaultUnit: null,
      aisle: "casa e pulizia",
    })
  })

  it("rejects a kind nobody defined", () => {
    expect(
      CatalogItemInputSchema.safeParse({ ...valid, kind: "HOUSEHOLD" }).success
    ).toBe(false)
  })

  it("refuses a unit that is only a number, which means it was typed in the wrong field", () => {
    const result = CatalogItemInputSchema.safeParse({
      ...valid,
      defaultUnit: "2",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "L’unità non è un numero. La quantità va nel campo accanto."
      )
    }
  })

  it("refuses a decimal typed into the unit too", () => {
    expect(
      CatalogItemInputSchema.safeParse({ ...valid, defaultUnit: "1,5" }).success
    ).toBe(false)
  })

  it("still accepts a unit that merely contains a digit", () => {
    expect(
      CatalogItemInputSchema.parse({ ...valid, defaultUnit: "cl 33" })
        .defaultUnit
    ).toBe("cl 33")
  })

  it("turns an empty preferred unit into null — most entries are counted", () => {
    expect(
      CatalogItemInputSchema.parse({ ...valid, defaultUnit: "  " }).defaultUnit
    ).toBeNull()
  })

  it("rejects an empty aisle, because the shopping list sorts by it", () => {
    const result = CatalogItemInputSchema.safeParse({ ...valid, aisle: "" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Scegli un reparto.")
    }
  })

  it("trims and lowercases the name", () => {
    expect(
      CatalogItemInputSchema.parse({ ...valid, name: "  Sale  " }).name
    ).toBe("sale")
  })
})
