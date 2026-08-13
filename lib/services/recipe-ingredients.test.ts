import { describe, expect, it } from "vitest"

import { ingredientRowsFrom } from "@/lib/services/recipe-ingredients"

describe("ingredientRowsFrom", () => {
  it("parses one row per line, in the order they were typed", () => {
    const rows = ingredientRowsFrom("320 g di spaghetti\n2 uova")

    expect(rows).toEqual([
      {
        raw: "320 g di spaghetti",
        name: "spaghetti",
        quantity: 320,
        unit: "g",
        position: 0,
      },
      { raw: "2 uova", name: "uova", quantity: 2, unit: null, position: 1 },
    ])
  })

  it("keeps the line exactly as written, so a wrong parse is still correctable", () => {
    const rows = ingredientRowsFrom("  un  bel  pizzico di sale  ")
    expect(rows[0].raw).toBe("un  bel  pizzico di sale")
  })

  it("drops blank lines rather than storing empty ingredients", () => {
    const rows = ingredientRowsFrom("sale q.b.\n\n   \npepe q.b.")
    expect(rows.map((row) => row.name)).toEqual(["sale", "pepe"])
  })

  it("renumbers positions after dropping blanks, leaving no gaps", () => {
    const rows = ingredientRowsFrom("sale q.b.\n\npepe q.b.")
    expect(rows.map((row) => row.position)).toEqual([0, 1])
  })

  it("accepts Windows line endings, because the text arrives from a browser", () => {
    const rows = ingredientRowsFrom("sale q.b.\r\npepe q.b.")
    expect(rows).toHaveLength(2)
    expect(rows[1].raw).toBe("pepe q.b.")
  })

  it("returns nothing for a block of only whitespace", () => {
    expect(ingredientRowsFrom("  \n \r\n ")).toEqual([])
  })

  it("keeps a line it cannot parse, unquantified rather than lost", () => {
    const rows = ingredientRowsFrom("qualcosa di misterioso")
    expect(rows[0]).toMatchObject({ quantity: null, unit: null })
    expect(rows[0].raw).toBe("qualcosa di misterioso")
  })
})
