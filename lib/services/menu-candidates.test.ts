import { describe, expect, it } from "vitest"

import {
  buildCandidateLines,
  indexCandidates,
  type CandidateRecipe,
} from "./menu-candidates"

const recipe = (over: Partial<CandidateRecipe> = {}): CandidateRecipe => ({
  id: "r1",
  title: "Spaghetti aglio e olio",
  course: "SECOND",
  totalMinutes: 15,
  tags: ["veloce", "vegetariano"],
  ingredients: ["spaghetti", "aglio fresco", "peperoncino"],
  lastCookedDaysAgo: null,
  ...over,
})

describe("buildCandidateLines", () => {
  it("numbers from one, because the schema bounds a one-based index", () => {
    const lines = buildCandidateLines([
      recipe(),
      recipe({ id: "r2", title: "Pollo" }),
    ])

    expect(lines).toContain("1. Spaghetti aglio e olio")
    expect(lines).toContain("2. Pollo")
  })

  it("carries the minutes, the tags and the ingredients, which the criteria need", () => {
    const lines = buildCandidateLines([recipe()])

    expect(lines).toContain("15min")
    expect(lines).toContain("veloce")
    expect(lines).toContain("spaghetti")
  })

  it("carries the course, so the model can see what it is choosing", () => {
    const lines = buildCandidateLines([recipe({ course: "SIDE" })])

    expect(lines).toContain("contorno")
  })

  it("never carries the instructions", () => {
    // Guarded by the type: CandidateRecipe has no instructions field. This test
    // states the intent so nobody widens the type without meeting it.
    const lines = buildCandidateLines([recipe()])

    expect(lines).not.toContain("Cuocere")
  })

  it("marks how long ago a recipe was last cooked", () => {
    const lines = buildCandidateLines([recipe({ lastCookedDaysAgo: 9 })])

    expect(lines).toContain("9 giorni fa")
  })

  it("says nothing about recency for a recipe never scheduled", () => {
    const lines = buildCandidateLines([recipe({ lastCookedDaysAgo: null })])

    expect(lines).not.toContain("giorni fa")
  })

  it("omits a missing duration rather than inventing one", () => {
    const lines = buildCandidateLines([recipe({ totalMinutes: null })])

    expect(lines).not.toContain("min")
  })

  it("survives a recipe with no tags and no ingredients", () => {
    const lines = buildCandidateLines([recipe({ tags: [], ingredients: [] })])

    expect(lines).toContain("1. Spaghetti aglio e olio")
  })

  it("puts one recipe on each line", () => {
    const lines = buildCandidateLines([
      recipe(),
      recipe({ id: "r2" }),
      recipe({ id: "r3" }),
    ])

    expect(lines.split("\n")).toHaveLength(3)
  })
})

describe("indexCandidates", () => {
  it("maps each number back to its recipe id and course", () => {
    const index = indexCandidates([
      recipe({ course: "FIRST" }),
      recipe({ id: "r2", course: "SIDE" }),
    ])

    expect(index.byNumber.get(1)).toEqual({ id: "r1", course: "FIRST" })
    expect(index.byNumber.get(2)).toEqual({ id: "r2", course: "SIDE" })
    expect(index.count).toBe(2)
  })

  it("counts zero for an empty book without throwing", () => {
    expect(indexCandidates([]).count).toBe(0)
  })

  it("numbers in step with buildCandidateLines, which is what makes the answer safe", () => {
    const recipes = [recipe(), recipe({ id: "r2", title: "Pollo" })]
    const lines = buildCandidateLines(recipes).split("\n")
    const index = indexCandidates(recipes)

    expect(lines[1]).toMatch(/^2\./)
    expect(index.byNumber.get(2)?.id).toBe("r2")
  })
})
