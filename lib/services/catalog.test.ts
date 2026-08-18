import { describe, expect, it } from "vitest"

import {
  isKnownAisle,
  kindFilterFor,
  rankUnitsByUse,
} from "@/lib/services/catalog"

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

describe("isKnownAisle", () => {
  it("accepts an aisle from the walking order", () => {
    expect(isKnownAisle("ortofrutta")).toBe(true)
  })

  it("accepts the catch-all, which is where unclassified ingredients live", () => {
    expect(isKnownAisle("altro")).toBe(true)
  })

  it("rejects anything else, so a typo cannot silently sort to the end", () => {
    expect(isKnownAisle("ortofruta")).toBe(false)
  })
})

describe("kindFilterFor", () => {
  it("maps the ingredients chip to a kind", () => {
    expect(kindFilterFor("ingredienti")).toBe("INGREDIENT")
  })

  it("maps the products chip to a kind", () => {
    expect(kindFilterFor("prodotti")).toBe("PRODUCT")
  })

  it("filters nothing when no chip is chosen", () => {
    expect(kindFilterFor(undefined)).toBeUndefined()
  })

  it("filters nothing for a value nobody offered, rather than listing zero rows", () => {
    expect(kindFilterFor("INGREDIENT")).toBeUndefined()
    expect(kindFilterFor("shampoo")).toBeUndefined()
  })

  it("cannot be made to return a value inherited from Object.prototype", () => {
    expect(kindFilterFor("constructor")).toBeUndefined()
    expect(kindFilterFor("toString")).toBeUndefined()
  })
})
