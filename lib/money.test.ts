import { describe, expect, it } from "vitest"

import { formatEuro } from "@/lib/money"

// Intl puts a non-breaking space before the symbol. Normalising it here keeps
// the assertions readable and honest about what is actually compared.
const plain = (value: string) => value.replace(/ /g, " ")

describe("formatEuro", () => {
  it("renders cents as Italian currency", () => {
    expect(plain(formatEuro(1234))).toBe("12,34 €")
  })

  it("keeps both decimals on a round amount", () => {
    expect(plain(formatEuro(1200))).toBe("12,00 €")
  })

  it("renders nothing spent as zero rather than as blank", () => {
    expect(plain(formatEuro(0))).toBe("0,00 €")
  })

  // ICU's default grouping for it-IT is "min2": no separator until five digits.
  // Asserted rather than argued with — it is what an Italian reader expects, and
  // a weekly shop never reaches either case anyway.
  it("leaves four digits ungrouped", () => {
    expect(plain(formatEuro(123456))).toBe("1234,56 €")
  })

  it("groups from five digits up", () => {
    expect(plain(formatEuro(1234567))).toBe("12.345,67 €")
  })
})
