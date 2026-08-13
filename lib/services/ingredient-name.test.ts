import { describe, expect, it } from "vitest"

import { normaliseIngredientName } from "@/lib/services/ingredient-name"

describe("normaliseIngredientName", () => {
  it.each([
    ["  Spaghetti  ", "spaghetti"],
    ["Pomodori Pelati", "pomodori pelati"],
    ["Olio   extravergine  d'oliva", "olio extravergine d'oliva"],
    ["di pomodoro", "pomodoro"],
    ["d'aglio", "aglio"],
    ["le patate", "patate"],
    ["della panna", "panna"],
    ["d’aglio", "aglio"],
    ["Olio extravergine d’oliva", "olio extravergine d'oliva"],
    ["l’aglio", "aglio"],
    ["dell'olio", "olio"],
    ["dell’aceto", "aceto"],
  ])("normalises %j to %j", (raw, expected) => {
    expect(normaliseIngredientName(raw)).toBe(expected)
  })

  it.each([
    ["lardo", "lardo"],
    ["lenticchie", "lenticchie"],
    ["limone", "limone"],
    ["dattero", "dattero"],
    ["ilex", "ilex"],
    ["delfino", "delfino"],
  ])(
    "leaves %j alone, because a particle needs a word after it",
    (raw, expected) => {
      expect(normaliseIngredientName(raw)).toBe(expected)
    }
  )

  it("keeps distinct wordings distinct, because there is no synonym table", () => {
    expect(normaliseIngredientName("Pomodori pelati")).not.toBe(
      normaliseIngredientName("pelati")
    )
  })

  it("is idempotent, because its output is stored and re-read as a key", () => {
    const once = normaliseIngredientName("  Della  Panna  ")
    expect(normaliseIngredientName(once)).toBe(once)
  })
})
