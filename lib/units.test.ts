import { describe, expect, it } from "vitest"

import { amountOf, takenAmountOf, unitFor } from "@/lib/units"

describe("unitFor", () => {
  it("leaves the unit alone for exactly one", () => {
    expect(unitFor("spicchio", 1)).toBe("spicchio")
    expect(unitFor("foglia", 1)).toBe("foglia")
  })

  it("pluralises the units the catalogue ships with", () => {
    const seeded: [string, string][] = [
      ["spicchio", "spicchi"],
      ["cucchiaio", "cucchiai"],
      ["barattolo", "barattoli"],
      ["gambo", "gambi"],
      ["mazzetto", "mazzetti"],
      ["rametto", "rametti"],
      ["rotolo", "rotoli"],
      ["bustina", "bustine"],
      ["foglia", "foglie"],
      ["lattina", "lattine"],
    ]

    for (const [singular, plural] of seeded) {
      expect(unitFor(singular, 3)).toBe(plural)
    }
  })

  // The rule that makes the symbols work without listing them.
  it("leaves a unit ending in a consonant alone, which is every symbol", () => {
    for (const symbol of ["g", "kg", "ml", "l", "cl"]) {
      expect(unitFor(symbol, 200)).toBe(symbol)
    }
  })

  it("keeps a hard c or g hard", () => {
    expect(unitFor("sacco", 2)).toBe("sacchi")
    expect(unitFor("asparago", 2)).toBe("asparaghi")
    expect(unitFor("busta", 2)).toBe("buste")
  })

  it("drops the i from -cia and -gia after a consonant", () => {
    expect(unitFor("goccia", 2)).toBe("gocce")
  })

  it("turns -e into -i", () => {
    expect(unitFor("confezione", 2)).toBe("confezioni")
  })

  it("pluralises for a fraction and for zero, because Italian does", () => {
    expect(unitFor("litro", 1.5)).toBe("litri")
    expect(unitFor("litro", 0)).toBe("litri")
  })
})

describe("amountOf", () => {
  it("renders nothing without a quantity", () => {
    expect(amountOf(null, "g")).toBeNull()
    expect(amountOf(null, null)).toBeNull()
  })

  it("renders the bare number when the thing is counted in pieces", () => {
    expect(amountOf(6, null)).toBe("6")
    expect(amountOf(6, "")).toBe("6")
  })

  it("agrees the unit with the quantity", () => {
    expect(amountOf(1, "spicchio")).toBe("1 spicchio")
    expect(amountOf(5, "spicchio")).toBe("5 spicchi")
    expect(amountOf(320, "g")).toBe("320 g")
  })
})

describe("takenAmountOf", () => {
  it("shows the line as it is when nobody said how much to take", () => {
    expect(takenAmountOf(null, 2, "burratina")).toBe("2 burratine")
    expect(takenAmountOf(null, null, null)).toBeNull()
  })

  it("names both numbers when less is going in the trolley", () => {
    expect(takenAmountOf(1, 2, "burratina")).toBe("1 di 2 burratine")
    expect(takenAmountOf(200, 500, "g")).toBe("200 di 500 g")
  })

  it("names both numbers when more is going in the trolley", () => {
    expect(takenAmountOf(3, 2, "burratina")).toBe("3 di 2 burratine")
  })

  it("says it once when the two numbers agree", () => {
    expect(takenAmountOf(2, 2, "burratina")).toBe("2 burratine")
  })

  it("shows the taken amount alone on an unquantified line", () => {
    expect(takenAmountOf(2, null, null)).toBe("2")
  })
})
