import { describe, expect, it } from "vitest"

import { matchesFirst, matchesQuery, searchTokens } from "@/lib/search"

describe("searchTokens", () => {
  it("splits on whitespace and lower-cases", () => {
    expect(searchTokens("Insalata  Zucchine")).toEqual(["insalata", "zucchine"])
  })

  it("is empty for a blank query, so nothing gets filtered", () => {
    expect(searchTokens("")).toEqual([])
    expect(searchTokens("   ")).toEqual([])
  })

  it("keeps the accents, because these tokens go to an ILIKE", () => {
    // Postgres folds case and not accents. Stripping the accent here would stop
    // «ragù» finding «Ragù», which is the opposite of the point.
    expect(searchTokens("Ragù")).toEqual(["ragù"])
  })

  it("caps a pasted paragraph at eight words", () => {
    const tokens = searchTokens("a b c d e f g h i j k")

    expect(tokens).toHaveLength(8)
    expect(tokens.at(-1)).toBe("h")
  })
})

describe("matchesQuery", () => {
  it("finds a title whose words are separated by others", () => {
    // The case this whole change exists for.
    expect(matchesQuery("Insalata con zucchine", "insalata zucchine")).toBe(
      true
    )
  })

  it("does not care what order the words come in", () => {
    expect(matchesQuery("Insalata con zucchine", "zucchine insalata")).toBe(
      true
    )
  })

  it("matches a word inside a longer one", () => {
    expect(matchesQuery("vegetariano", "veget")).toBe(true)
  })

  it("refuses when one of the words is missing", () => {
    expect(matchesQuery("Insalata con zucchine", "insalata pomodori")).toBe(
      false
    )
  })

  it("ignores case", () => {
    expect(matchesQuery("Insalata", "INSALATA")).toBe(true)
  })

  it("ignores accents in both directions", () => {
    // Base UI's own combobox filter already does this, at sensitivity "base".
    // Replacing it with something stricter would be a regression.
    expect(matchesQuery("Ragù alla bolognese", "ragu")).toBe(true)
    expect(matchesQuery("Ragu alla bolognese", "ragù")).toBe(true)
  })

  it("matches everything when the query is blank", () => {
    expect(matchesQuery("qualunque cosa", "")).toBe(true)
    expect(matchesQuery("qualunque cosa", "   ")).toBe(true)
  })
})

describe("matchesFirst", () => {
  const titled = (title: string) => ({ title })
  const titles = (rows: { title: string }[]) => rows.map((row) => row.title)

  it("lifts the rows the query answers directly", () => {
    // A recipe merely using zucchine matched too, and creation order would bury
    // the one that is actually called that.
    const sorted = matchesFirst(
      [titled("Pollo al forno"), titled("Zucchine ripiene")],
      "zucchine",
      (row) => row.title
    )

    expect(titles(sorted)).toEqual(["Zucchine ripiene", "Pollo al forno"])
  })

  it("keeps the order it was given inside each group", () => {
    const sorted = matchesFirst(
      [
        titled("Zucchine ripiene"),
        titled("Pollo al forno"),
        titled("Zucchine grigliate"),
        titled("Riso al salto"),
      ],
      "zucchine",
      (row) => row.title
    )

    expect(titles(sorted)).toEqual([
      "Zucchine ripiene",
      "Zucchine grigliate",
      "Pollo al forno",
      "Riso al salto",
    ])
  })

  it("leaves a blank query's order alone, because everything matches it", () => {
    const sorted = matchesFirst(
      [titled("Pollo"), titled("Riso")],
      "",
      (row) => row.title
    )

    expect(titles(sorted)).toEqual(["Pollo", "Riso"])
  })

  it("does not mutate what it was given", () => {
    const rows = [titled("Pollo al forno"), titled("Zucchine ripiene")]
    matchesFirst(rows, "zucchine", (row) => row.title)

    expect(rows[0].title).toBe("Pollo al forno")
  })
})
