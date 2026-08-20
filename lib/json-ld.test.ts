import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { findRecipe, readJsonLd } from "@/lib/json-ld"

const page = readFileSync(
  "lib/__fixtures__/cucchiaio-insalata-di-riso.html",
  "utf8"
)

const block = (json: string) =>
  `<html><head><script type="application/ld+json">${json}</script></head></html>`

describe("readJsonLd", () => {
  it("recovers a block that JSON.parse refuses", () => {
    // The captured page puts raw newlines inside string literals. A strict
    // reader finds nothing on the one page we know the users share.
    expect(findRecipe(readJsonLd(page))).not.toBeNull()
  })

  it("keeps the good block when another one is unreadable", () => {
    const html =
      block("{ this is not json at all }") +
      block('{"@type":"Recipe","name":"Torta"}')
    expect(findRecipe(readJsonLd(html))?.name).toBe("Torta")
  })

  it("finds a recipe inside @graph", () => {
    const html = block(
      '{"@graph":[{"@type":"WebPage"},{"@type":"Recipe","name":"Torta"}]}'
    )
    expect(findRecipe(readJsonLd(html))?.name).toBe("Torta")
  })

  it("finds a recipe whose @type is an array", () => {
    const html = block('{"@type":["Thing","Recipe"],"name":"Torta"}')
    expect(findRecipe(readJsonLd(html))?.name).toBe("Torta")
  })

  it("returns null when the page publishes no recipe", () => {
    const html = block('{"@type":"WebPage","name":"Chi siamo"}')
    expect(findRecipe(readJsonLd(html))).toBeNull()
  })
})

describe("the captured page", () => {
  it("carries the fields the mapping needs", () => {
    const recipe = findRecipe(readJsonLd(page))

    expect(recipe?.name).toBe("Insalata di riso")
    expect(recipe?.recipeYield).toBe("4 - 6 porzioni")
    expect(recipe?.prepTime).toBe("PT25M")
    expect(recipe?.cookTime).toBe("PT15M")
    expect(recipe?.totalTime).toBeUndefined()
    expect(recipe?.recipeIngredient).toHaveLength(9)
  })
})
