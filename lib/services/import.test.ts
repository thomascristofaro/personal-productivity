import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { draftFromHtml } from "@/lib/services/import"

const page = readFileSync(
  "lib/__fixtures__/cucchiaio-insalata-di-riso.html",
  "utf8"
)
const SOURCE = "https://www.cucchiaio.it/ricetta/ricetta-insalata-riso/"

const recipe = (fields: string) =>
  `<html><head><script type="application/ld+json">
    {"@type":"Recipe","name":"Torta",${fields},"recipeIngredient":["1 uovo"]}
  </script></head></html>`

describe("draftFromHtml", () => {
  it("maps the captured page", () => {
    const draft = draftFromHtml(page, SOURCE)

    expect(draft).not.toBeNull()
    expect(draft?.title).toBe("Insalata di riso")
    expect(draft?.sourceUrl).toBe(SOURCE)
    // "4 - 6 porzioni": the first number, because the confirmation screen is
    // where a range gets settled.
    expect(draft?.servings).toBe(4)
    // No totalTime on this page — prepTime plus cookTime.
    expect(draft?.totalMinutes).toBe(40)
    expect(draft?.instructions).toContain("lessate il riso")
    expect(draft?.ingredients).toHaveLength(9)
  })

  it("parses the ingredient lines with the parser we already have", () => {
    const draft = draftFromHtml(page, SOURCE)

    expect(draft?.ingredients[0]).toEqual({
      ingredientName: "riso",
      unit: "g",
      quantity: 300,
    })
    // A line with no quantity is the "q.b." case and stays that way.
    expect(draft?.ingredients[5]).toEqual({
      ingredientName: "prezzemolo",
      unit: null,
      quantity: null,
    })
  })

  it("returns null for a page with no recipe in it", () => {
    expect(draftFromHtml("<html><body>ciao</body></html>", SOURCE)).toBeNull()
  })

  it("drops a servings count the recipe schema would refuse", () => {
    // Pre-filling a value that cannot be saved teaches the user that the form
    // is broken. RecipeInputSchema caps servings at 50.
    expect(
      draftFromHtml(recipe('"recipeYield":"per 400 persone"'), SOURCE)?.servings
    ).toBeNull()
  })

  it("leaves servings empty when the yield names no number", () => {
    expect(
      draftFromHtml(recipe('"recipeYield":"per una teglia"'), SOURCE)?.servings
    ).toBeNull()
  })

  it("prefers totalTime when the page publishes one", () => {
    expect(
      draftFromHtml(
        recipe('"totalTime":"PT1H","prepTime":"PT10M","cookTime":"PT5M"'),
        SOURCE
      )?.totalMinutes
    ).toBe(60)
  })
})
