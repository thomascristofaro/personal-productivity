import { describe, expect, it } from "vitest"

import {
  isListStale,
  nextPosition,
  sortEntries,
  type MenuEntryView,
} from "@/lib/services/menus"

const entry = (over: Partial<MenuEntryView>): MenuEntryView => ({
  id: "e1",
  day: 0,
  meal: "LUNCH",
  position: 0,
  recipeId: null,
  recipeTitle: null,
  freeText: null,
  servings: null,
  ...over,
})

describe("sortEntries", () => {
  it("orders by day first", () => {
    const sorted = sortEntries([entry({ day: 3 }), entry({ day: 1 })])

    expect(sorted.map((row) => row.day)).toEqual([1, 3])
  })

  it("puts lunch before dinner within a day", () => {
    const sorted = sortEntries([
      entry({ meal: "DINNER" }),
      entry({ meal: "LUNCH" }),
    ])

    expect(sorted.map((row) => row.meal)).toEqual(["LUNCH", "DINNER"])
  })

  it("keeps a meal's dishes in the order they were added", () => {
    const sorted = sortEntries([
      entry({ id: "c", position: 2 }),
      entry({ id: "a", position: 0 }),
      entry({ id: "b", position: 1 }),
    ])

    expect(sorted.map((row) => row.id)).toEqual(["a", "b", "c"])
  })

  it("breaks a shared position on the id, so the order never wobbles", () => {
    // Two entries added in the same instant can land on one position — the
    // model allows it on purpose. What it must not do is reorder between two
    // renders of the same data.
    const rows = [
      entry({ id: "z", position: 1 }),
      entry({ id: "a", position: 1 }),
    ]

    expect(sortEntries(rows).map((row) => row.id)).toEqual(["a", "z"])
    expect(sortEntries([...rows].reverse()).map((row) => row.id)).toEqual([
      "a",
      "z",
    ])
  })

  it("returns only what it was given — an empty week is empty, not fourteen", () => {
    expect(sortEntries([])).toEqual([])
  })

  it("does not mutate its argument", () => {
    const rows = [entry({ day: 3 }), entry({ day: 1 })]
    sortEntries(rows)

    expect(rows[0].day).toBe(3)
  })
})

describe("nextPosition", () => {
  it("starts an empty meal at zero", () => {
    expect(nextPosition([])).toBe(0)
  })

  it("appends after the last dish rather than filling a gap", () => {
    // A gap is what a removal leaves behind. Filling it would put the new dish
    // in the middle of a list the user is reading top to bottom.
    expect(nextPosition([0, 3])).toBe(4)
  })

  it("appends past a shared position", () => {
    expect(nextPosition([0, 1, 1])).toBe(2)
  })
})

describe("isListStale", () => {
  it("is stale when the menu changed after the list was built", () => {
    expect(
      isListStale(
        new Date("2026-08-14T10:00:00Z"),
        new Date("2026-08-14T09:00:00Z")
      )
    ).toBe(true)
  })

  it("is not stale when the list was built after the menu changed", () => {
    expect(
      isListStale(
        new Date("2026-08-14T09:00:00Z"),
        new Date("2026-08-14T10:00:00Z")
      )
    ).toBe(false)
  })

  it("is not stale on the same instant — generating right after an edit is the normal case", () => {
    const now = new Date("2026-08-14T10:00:00Z")
    expect(isListStale(now, now)).toBe(false)
  })
})
