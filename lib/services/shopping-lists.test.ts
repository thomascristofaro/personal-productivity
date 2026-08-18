import { describe, expect, it } from "vitest"

import { groupByAisle, type StoredItem } from "@/lib/services/shopping-lists"

const item = (over: Partial<StoredItem>): StoredItem => ({
  id: "cm3xk1p2h0000abcdefghijkl",
  name: "mele",
  quantity: null,
  unit: null,
  aisle: "ortofrutta",
  checked: false,
  checkedById: null,
  checkedAt: null,
  manual: false,
  days: [],
  ...over,
})

describe("groupByAisle", () => {
  it("returns nothing for an empty list", () => {
    expect(groupByAisle([])).toEqual([])
  })

  it("puts the aisles in walking order, not alphabetical order", () => {
    const groups = groupByAisle([
      item({ id: "a", name: "latte", aisle: "banco frigo" }),
      item({ id: "b", name: "mele", aisle: "ortofrutta" }),
    ])

    expect(groups.map((group) => group.aisle)).toEqual([
      "ortofrutta",
      "banco frigo",
    ])
  })

  it("keeps the catch-all last, whatever its name would sort as", () => {
    const groups = groupByAisle([
      item({ id: "a", name: "sacchetti", aisle: "altro" }),
      item({ id: "b", name: "vino", aisle: "bevande" }),
    ])

    expect(groups[groups.length - 1].aisle).toBe("altro")
  })

  it("gathers every item of one aisle into a single group", () => {
    const groups = groupByAisle([
      item({ id: "a", name: "mele", aisle: "ortofrutta" }),
      item({ id: "b", name: "latte", aisle: "banco frigo" }),
      item({ id: "c", name: "pere", aisle: "ortofrutta" }),
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0].items.map((i) => i.name)).toEqual(["mele", "pere"])
  })

  it("sorts within an aisle by name, in Italian", () => {
    const groups = groupByAisle([
      item({ id: "a", name: "zucchine" }),
      item({ id: "b", name: "àglio" }),
      item({ id: "c", name: "mele" }),
    ])

    expect(groups[0].items.map((i) => i.name)).toEqual([
      "àglio",
      "mele",
      "zucchine",
    ])
  })
})
