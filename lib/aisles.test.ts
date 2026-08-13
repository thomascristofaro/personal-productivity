import { describe, expect, it } from "vitest"

import { AISLE_ORDER, AISLE_UNKNOWN, aisleRank } from "@/lib/aisles"

describe("aisleRank", () => {
  it("orders produce before the pantry", () => {
    expect(aisleRank("ortofrutta")).toBeLessThan(aisleRank("dispensa"))
  })

  it("puts the catch-all aisle after every named one", () => {
    const named = AISLE_ORDER.filter((aisle) => aisle !== AISLE_UNKNOWN)
    for (const aisle of named) {
      expect(aisleRank(aisle)).toBeLessThan(aisleRank(AISLE_UNKNOWN))
    }
  })

  it("puts an aisle it has never heard of last", () => {
    expect(aisleRank("reparto immaginario")).toBeGreaterThanOrEqual(
      aisleRank(AISLE_UNKNOWN)
    )
  })

  it("sorts a shuffled list back into walking order", () => {
    const shuffled = [
      "dispensa",
      "reparto immaginario",
      "ortofrutta",
      AISLE_UNKNOWN,
    ]
    expect([...shuffled].sort((a, b) => aisleRank(a) - aisleRank(b))).toEqual([
      "ortofrutta",
      "dispensa",
      AISLE_UNKNOWN,
      "reparto immaginario",
    ])
  })
})
