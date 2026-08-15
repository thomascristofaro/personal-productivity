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

  it("ranks an aisle it has never heard of alongside the catch-all, not after it", () => {
    expect(aisleRank("reparto immaginario")).toBe(aisleRank(AISLE_UNKNOWN))
  })

  it("sorts a shuffled list back into walking order, with an unrecognised aisle landing in the catch-all group rather than after it", () => {
    const shuffled = [
      "dispensa",
      "reparto immaginario",
      "ortofrutta",
      AISLE_UNKNOWN,
    ]
    const sorted = [...shuffled].sort((a, b) => aisleRank(a) - aisleRank(b))

    expect(sorted.slice(0, 2)).toEqual(["ortofrutta", "dispensa"])
    expect(new Set(sorted.slice(2))).toEqual(
      new Set(["reparto immaginario", AISLE_UNKNOWN])
    )
  })
})
