import { describe, expect, it } from "vitest"

import type { StoredItem } from "@/lib/services/shopping-lists"
import { groupByAisle, mergeLines } from "@/lib/services/shopping-view"

let next = 0
const item = (over: Partial<StoredItem>): StoredItem => ({
  id: `id-${++next}`,
  name: "pomodori",
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

describe("mergeLines", () => {
  it("returns nothing for an empty list", () => {
    expect(mergeLines([])).toEqual([])
  })

  it("leaves two different things alone", () => {
    expect(
      mergeLines([item({ name: "pomodori" }), item({ name: "mele" })])
    ).toHaveLength(2)
  })

  it("sums the quantities of one name and one unit", () => {
    const lines = mergeLines([
      item({ quantity: 300, unit: "g" }),
      item({ quantity: 200, unit: "g", manual: true }),
    ])

    expect(lines).toHaveLength(1)
    expect(lines[0].quantity).toBe(500)
  })

  it("keeps two units apart, because 2 spicchi and 200 g are not one line", () => {
    expect(
      mergeLines([
        item({ name: "aglio fresco", quantity: 2, unit: "spicchio" }),
        item({ name: "aglio fresco", quantity: 200, unit: "g" }),
      ])
    ).toHaveLength(2)
  })

  it("keeps a null unit apart from a named one", () => {
    expect(
      mergeLines([
        item({ quantity: 2, unit: null }),
        item({ quantity: 200, unit: "g" }),
      ])
    ).toHaveLength(2)
  })

  it("stays unquantified when every row is", () => {
    expect(
      mergeLines([item({ quantity: null }), item({ quantity: null })])[0]
        .quantity
    ).toBeNull()
  })

  it("sums the quantified rows and ignores the unquantified one", () => {
    // Same name, both units null — one line. "olio q.b." plus 200 is 200, not
    // nothing and not a second line.
    const lines = mergeLines([
      item({ quantity: null }),
      item({ quantity: 200, unit: null }),
    ])

    expect(lines).toHaveLength(1)
    expect(lines[0].quantity).toBe(200)
  })

  it("loses the floating-point noise a sum introduces", () => {
    expect(
      mergeLines([
        item({ quantity: 0.1, unit: "l" }),
        item({ quantity: 0.2, unit: "l" }),
      ])[0].quantity
    ).toBe(0.3)
  })

  it("holds every id behind the line, so ticking it ticks them all", () => {
    expect(
      mergeLines([
        item({ id: "a", quantity: 300, unit: "g" }),
        item({ id: "b", quantity: 200, unit: "g" }),
      ])[0].ids
    ).toEqual(["a", "b"])
  })

  it("is ticked only when every row behind it is", () => {
    expect(
      mergeLines([
        item({ quantity: 300, unit: "g", checked: true }),
        item({ quantity: 200, unit: "g", checked: false }),
      ])[0].checked
    ).toBe(false)
  })

  it("is ticked when they all are", () => {
    expect(
      mergeLines([
        item({ quantity: 300, unit: "g", checked: true }),
        item({ quantity: 200, unit: "g", checked: true }),
      ])[0].checked
    ).toBe(true)
  })

  it("names only the rows added by hand, so the bin removes only those", () => {
    expect(
      mergeLines([
        item({ id: "generated", quantity: 300, unit: "g" }),
        item({ id: "byhand", quantity: 200, unit: "g", manual: true }),
      ])[0].manualIds
    ).toEqual(["byhand"])
  })

  it("names no manual rows when the menu produced all of them", () => {
    expect(mergeLines([item({ quantity: 300, unit: "g" })])[0].manualIds).toEqual(
      []
    )
  })

  it("unites the days, in order, without repeating one", () => {
    expect(
      mergeLines([
        item({ quantity: 300, unit: "g", days: [4, 1] }),
        item({ quantity: 200, unit: "g", days: [1, 2] }),
      ])[0].days
    ).toEqual([1, 2, 4])
  })

  it("takes the earliest aisle in walking order when two rows disagree", () => {
    expect(
      mergeLines([
        item({ quantity: 1, unit: null, aisle: "dispensa" }),
        item({ quantity: 1, unit: null, aisle: "ortofrutta" }),
      ])[0].aisle
    ).toBe("ortofrutta")
  })

  it("gives one line one stable key, whatever the row ids are", () => {
    // The key survives a regeneration renumbering every row, which is what lets
    // React keep the checkbox it was rendering.
    const first = mergeLines([item({ id: "a", quantity: 1, unit: "g" })])
    const second = mergeLines([item({ id: "b", quantity: 9, unit: "g" })])

    expect(first[0].key).toBe(second[0].key)
  })

  it("cannot be tricked into one line by a name containing the separator", () => {
    expect(
      mergeLines([
        item({ name: 'pomodori","g' }),
        item({ name: "pomodori", unit: "g" }),
      ])
    ).toHaveLength(2)
  })
})

const line = (over: Partial<StoredItem>) => mergeLines([item(over)])[0]

describe("groupByAisle", () => {
  it("returns nothing for an empty list", () => {
    expect(groupByAisle([])).toEqual([])
  })

  it("puts the aisles in walking order, not alphabetical order", () => {
    expect(
      groupByAisle([
        line({ name: "latte", aisle: "banco frigo" }),
        line({ name: "mele", aisle: "ortofrutta" }),
      ]).map((group) => group.aisle)
    ).toEqual(["ortofrutta", "banco frigo"])
  })

  it("keeps the catch-all last, whatever its name would sort as", () => {
    const groups = groupByAisle([
      line({ name: "sacchetti", aisle: "altro" }),
      line({ name: "vino", aisle: "bevande" }),
    ])

    expect(groups[groups.length - 1].aisle).toBe("altro")
  })

  it("gathers every line of one aisle into a single group, by name", () => {
    expect(
      groupByAisle([
        line({ name: "pere", aisle: "ortofrutta" }),
        line({ name: "latte", aisle: "banco frigo" }),
        line({ name: "mele", aisle: "ortofrutta" }),
      ])[0].lines.map((entry) => entry.name)
    ).toEqual(["mele", "pere"])
  })

  it("folds an aisle nobody recognises in with the catch-all", () => {
    expect(
      groupByAisle([
        line({ name: "sacchetti", aisle: "altro" }),
        line({ name: "shampoo", aisle: "ortofruta" }),
      ])
    ).toHaveLength(1)
  })
})
