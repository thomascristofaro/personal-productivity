import { describe, expect, it } from "vitest"

import {
  isListStale,
  sortSlots,
  type MenuSlotView,
} from "@/lib/services/menus"

const stored = (over: Partial<MenuSlotView>): MenuSlotView => ({
  day: 0,
  meal: "LUNCH",
  course: "SECOND",
  recipeId: null,
  recipeTitle: null,
  freeText: null,
  servings: null,
  ...over,
})

describe("sortSlots", () => {
  it("orders by day first", () => {
    const sorted = sortSlots([stored({ day: 3 }), stored({ day: 1 })])

    expect(sorted.map((slot) => slot.day)).toEqual([1, 3])
  })

  it("puts lunch before dinner within a day", () => {
    const sorted = sortSlots([
      stored({ meal: "DINNER" }),
      stored({ meal: "LUNCH" }),
    ])

    expect(sorted.map((slot) => slot.meal)).toEqual(["LUNCH", "DINNER"])
  })

  it("orders a meal the way it is eaten, not alphabetically", () => {
    // Alphabetically it would be FIRST, SECOND, SIDE — which happens to be
    // right. Written with the courses shuffled so the test would still catch a
    // sort that fell back to comparing the strings.
    const sorted = sortSlots([
      stored({ course: "SIDE" }),
      stored({ course: "SECOND" }),
      stored({ course: "FIRST" }),
    ])

    expect(sorted.map((slot) => slot.course)).toEqual([
      "FIRST",
      "SECOND",
      "SIDE",
    ])
  })

  it("returns only what it was given — an empty week is empty, not fourteen", () => {
    expect(sortSlots([])).toEqual([])
  })

  it("does not mutate its argument", () => {
    const input = [stored({ day: 3 }), stored({ day: 1 })]
    sortSlots(input)

    expect(input[0].day).toBe(3)
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
