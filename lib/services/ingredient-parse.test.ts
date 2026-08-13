import { describe, expect, it } from "vitest"

import { parseIngredientLine } from "@/lib/services/ingredient-parse"

describe("parseIngredientLine", () => {
  it.each([
    ["320 g di spaghetti", 320, "g", "spaghetti"],
    ["1,5 kg di patate", 1.5, "kg", "patate"],
    ["1.5 kg di patate", 1.5, "kg", "patate"],
    ["200 ml di panna", 200, "ml", "panna"],
    ["500 gr di pomodori pelati", 500, "g", "pomodori pelati"],
    [
      "2 cucchiai di parmigiano grattugiato",
      2,
      "cucchiaio",
      "parmigiano grattugiato",
    ],
    ["1 spicchio d'aglio", 1, "spicchio", "aglio"],
    ["un cucchiaio di zucchero", 1, "cucchiaio", "zucchero"],
  ])("parses %j", (raw, quantity, unit, name) => {
    expect(parseIngredientLine(raw)).toEqual({ raw, quantity, unit, name })
  })

  it.each([
    ["2 uova", 2, "uova"],
    ["1/2 cipolla", 0.5, "cipolla"],
    ["una cipolla", 1, "cipolla"],
    ["un'acciuga", 1, "acciuga"],
  ])("reads %j as a bare count with no unit", (raw, quantity, name) => {
    expect(parseIngredientLine(raw)).toEqual({
      raw,
      quantity,
      unit: null,
      name,
    })
  })

  it.each([
    ["sale q.b.", "sale"],
    ["olio extravergine d'oliva q.b.", "olio extravergine d'oliva"],
    ["pepe qb", "pepe"],
    ["prezzemolo", "prezzemolo"],
    ["basilico quanto basta", "basilico"],
  ])("reads %j as unquantified", (raw, name) => {
    expect(parseIngredientLine(raw)).toEqual({
      raw,
      quantity: null,
      unit: null,
      name,
    })
  })

  it("preserves the original line even when it understands nothing", () => {
    const raw = "q.b. 1 1/2 misteri assortiti"
    expect(parseIngredientLine(raw).raw).toBe(raw)
  })

  it("does not mistake the start of a word for the article one", () => {
    expect(parseIngredientLine("unghie di gallina").quantity).toBeNull()
  })
})
