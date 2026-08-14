import { describe, expect, it } from "vitest"

import { rankUnitsByUse } from "@/lib/services/ingredients"

describe("rankUnitsByUse", () => {
  it("puts the most used unit first", () => {
    expect(
      rankUnitsByUse([
        { unit: "ml", uses: 2 },
        { unit: "g", uses: 9 },
      ])
    ).toEqual(["g", "ml"])
  })

  it("breaks a tie alphabetically, so the order is stable between requests", () => {
    expect(
      rankUnitsByUse([
        { unit: "pz", uses: 3 },
        { unit: "g", uses: 3 },
      ])
    ).toEqual(["g", "pz"])
  })

  it("drops nulls, because an unquantified line has no unit to suggest", () => {
    expect(
      rankUnitsByUse([
        { unit: null, uses: 7 },
        { unit: "g", uses: 1 },
      ])
    ).toEqual(["g"])
  })

  it("drops blank and whitespace-only units", () => {
    expect(
      rankUnitsByUse([
        { unit: "  ", uses: 5 },
        { unit: "g", uses: 1 },
      ])
    ).toEqual(["g"])
  })
})
