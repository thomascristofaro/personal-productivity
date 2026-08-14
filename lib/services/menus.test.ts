import { describe, expect, it } from "vitest"

import { buildWeekSlots, type MenuSlotView } from "@/lib/services/menus"

const stored = (over: Partial<MenuSlotView>): MenuSlotView => ({
  day: 0,
  meal: "LUNCH",
  recipeId: null,
  recipeTitle: null,
  freeText: null,
  servings: null,
  ...over,
})

describe("buildWeekSlots", () => {
  it("always returns fourteen slots, even for an untouched week", () => {
    expect(buildWeekSlots([])).toHaveLength(14)
  })

  it("orders them day by day, lunch before dinner", () => {
    const slots = buildWeekSlots([])
    expect(slots.slice(0, 3).map((slot) => [slot.day, slot.meal])).toEqual([
      [0, "LUNCH"],
      [0, "DINNER"],
      [1, "LUNCH"],
    ])
    expect(slots[13]).toMatchObject({ day: 6, meal: "DINNER" })
  })

  it("puts a stored slot in its own place and leaves the rest empty", () => {
    const slots = buildWeekSlots([
      stored({ day: 2, meal: "DINNER", recipeId: "abc", recipeTitle: "Ragù" }),
    ])

    expect(slots.find((s) => s.day === 2 && s.meal === "DINNER")).toMatchObject(
      {
        recipeId: "abc",
        recipeTitle: "Ragù",
      }
    )
    expect(slots.filter((s) => s.recipeId !== null)).toHaveLength(1)
  })

  it("keeps a free-text slot as text, with no recipe", () => {
    const slots = buildWeekSlots([
      stored({ day: 5, meal: "DINNER", freeText: "fuori a cena" }),
    ])

    expect(slots.find((s) => s.day === 5 && s.meal === "DINNER")).toMatchObject(
      {
        freeText: "fuori a cena",
        recipeId: null,
      }
    )
  })

  it("drops a row outside the week rather than growing the grid", () => {
    // Nothing in the database constrains `day` to 0..6, so a bad row must not
    // reach the screen as an eighth day.
    expect(buildWeekSlots([stored({ day: 9 })])).toHaveLength(14)
  })
})
