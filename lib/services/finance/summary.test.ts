import { describe, expect, it } from "vitest"

import {
  type CountableRow,
  countsTowardsTotals,
  meanOf,
  outgoingsByCategory,
  totalsOf,
} from "@/lib/services/finance/summary"

const row = (over: Partial<CountableRow> = {}): CountableRow => ({
  amountCents: -1000,
  categoryId: "spesa",
  categoryKind: "EXPENSE",
  ...over,
})

describe("countsTowardsTotals", () => {
  it("counts an expense", () => {
    expect(countsTowardsTotals("EXPENSE")).toBe(true)
  })

  it("counts income", () => {
    expect(countsTowardsTotals("INCOME")).toBe(true)
  })

  it("does not count a transfer", () => {
    expect(countsTowardsTotals("TRANSFER")).toBe(false)
  })

  it("counts a movement with no category at all", () => {
    // It is real money. Dropping it would make the totals quietly small, which
    // is the module's one unacceptable failure wearing a different hat.
    expect(countsTowardsTotals(null)).toBe(true)
  })
})

describe("totalsOf", () => {
  it("splits outgoings from income", () => {
    expect(
      totalsOf([
        row({ amountCents: -4230 }),
        row({ amountCents: 185000, categoryKind: "INCOME" }),
      ])
    ).toEqual({
      incomeCents: 185000,
      outgoingsCents: -4230,
      uncategorisedCount: 0,
    })
  })

  it("leaves both legs of a transfer out of both", () => {
    expect(
      totalsOf([
        row({ amountCents: -20000, categoryKind: "TRANSFER" }),
        row({ amountCents: 20000, categoryKind: "TRANSFER" }),
      ])
    ).toEqual({ incomeCents: 0, outgoingsCents: 0, uncategorisedCount: 0 })
  })

  it("counts an uncategorised movement, and says how many there are", () => {
    expect(totalsOf([row({ categoryId: null, categoryKind: null })])).toEqual({
      incomeCents: 0,
      outgoingsCents: -1000,
      uncategorisedCount: 1,
    })
  })

  it("is zero for a month with nothing in it", () => {
    expect(totalsOf([])).toEqual({
      incomeCents: 0,
      outgoingsCents: 0,
      uncategorisedCount: 0,
    })
  })
})

describe("outgoingsByCategory", () => {
  it("adds up each category and puts the biggest first", () => {
    expect(
      outgoingsByCategory([
        row({ amountCents: -1000 }),
        row({ amountCents: -2000, categoryId: "bar" }),
        row({ amountCents: -500 }),
      ])
    ).toEqual([
      { categoryId: "bar", cents: -2000 },
      { categoryId: "spesa", cents: -1500 },
    ])
  })

  it("keeps the uncategorised together under null", () => {
    expect(
      outgoingsByCategory([row({ categoryId: null, categoryKind: null })])
    ).toEqual([{ categoryId: null, cents: -1000 }])
  })

  it("leaves out income and transfers", () => {
    expect(
      outgoingsByCategory([
        row({ amountCents: 185000, categoryKind: "INCOME" }),
        row({ amountCents: -20000, categoryKind: "TRANSFER" }),
      ])
    ).toEqual([])
  })
})

describe("meanOf", () => {
  it("averages the months that have data", () => {
    expect(meanOf([-10000, -20000, -30000])).toBe(-20000)
  })

  it("ignores a month with no data at all", () => {
    // Not the same as a month where nothing was spent on this category: that
    // one is a zero and pulls the mean down, which is correct.
    expect(meanOf([-10000, null, -30000])).toBe(-20000)
  })

  it("counts a month with a real zero", () => {
    expect(meanOf([-10000, 0, -20000])).toBe(-10000)
  })

  it("returns null when no month has data", () => {
    expect(meanOf([null, null])).toBeNull()
  })

  it("rounds to whole cents", () => {
    // -10000.5 rounds to -10000: Math.round breaks a tie towards positive
    // infinity, so a negative half goes to the smaller magnitude. Half a cent
    // on a three-month average, and the alternative is a rounding rule nobody
    // reading the summary would be able to predict either.
    expect(meanOf([-10000, -10001])).toBe(-10000)
  })
})
