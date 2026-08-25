import { describe, expect, it } from "vitest"

import {
  amountToCents,
  cellToUtcMidnight,
  dateToUtcMidnight,
  numberToCents,
} from "@/lib/services/finance/values"

describe("amountToCents", () => {
  it("reads a plain decimal point, as Revolut writes it", () => {
    expect(amountToCents("-12.50")).toBe(-1250)
  })

  it("reads a decimal comma, as an Italian export writes it", () => {
    expect(amountToCents("-12,50")).toBe(-1250)
  })

  it("reads a thousands dot with a decimal comma", () => {
    expect(amountToCents("1.234,56")).toBe(123456)
  })

  it("reads a thousands comma with a decimal point", () => {
    expect(amountToCents("1,234.56")).toBe(123456)
  })

  it("reads a lone separator followed by three digits as thousands", () => {
    expect(amountToCents("1.234")).toBe(123400)
  })

  it("reads a lone separator followed by two digits as decimals", () => {
    expect(amountToCents("12.34")).toBe(1234)
  })

  it("ignores a currency symbol and the space before it", () => {
    expect(amountToCents("12,50 €")).toBe(1250)
    expect(amountToCents("€ 12,50")).toBe(1250)
  })

  it("keeps an explicit plus", () => {
    expect(amountToCents("+200,00")).toBe(20000)
  })

  it("reads the unicode minus some exports use", () => {
    expect(amountToCents("−12,50")).toBe(-1250)
  })

  it("rounds rather than truncating, so a cent is not lost", () => {
    // 12.34 * 100 is 1233.9999999999998 in binary floating point.
    expect(amountToCents("12,34")).toBe(1234)
  })

  it("returns null for something that is not an amount", () => {
    expect(amountToCents("")).toBeNull()
    expect(amountToCents("n/d")).toBeNull()
    expect(amountToCents("--3")).toBeNull()
  })
})

describe("dateToUtcMidnight", () => {
  it("reads an ISO date", () => {
    expect(dateToUtcMidnight("2026-07-15")?.toISOString()).toBe(
      "2026-07-15T00:00:00.000Z"
    )
  })

  it("drops the time an ISO timestamp carries", () => {
    expect(dateToUtcMidnight("2026-07-15 23:40:00")?.toISOString()).toBe(
      "2026-07-15T00:00:00.000Z"
    )
  })

  it("reads a slashed Italian date", () => {
    expect(dateToUtcMidnight("15/07/2026")?.toISOString()).toBe(
      "2026-07-15T00:00:00.000Z"
    )
  })

  it("reads a dotted Italian date", () => {
    expect(dateToUtcMidnight("15.07.2026")?.toISOString()).toBe(
      "2026-07-15T00:00:00.000Z"
    )
  })

  it("reads a two-digit year as this century", () => {
    expect(dateToUtcMidnight("15/07/26")?.toISOString()).toBe(
      "2026-07-15T00:00:00.000Z"
    )
  })

  it("refuses a day that does not exist rather than rolling into August", () => {
    expect(dateToUtcMidnight("31/06/2026")).toBeNull()
  })

  it("returns null for something that is not a date", () => {
    expect(dateToUtcMidnight("")).toBeNull()
    expect(dateToUtcMidnight("ieri")).toBeNull()
  })
})

describe("numberToCents", () => {
  it("reads an amount a spreadsheet already parsed", () => {
    expect(numberToCents(-19.82)).toBe(-1982)
    expect(numberToCents(50)).toBe(5000)
  })

  it("rounds rather than truncating, so a cent is not lost in binary", () => {
    expect(numberToCents(0.07)).toBe(7)
    expect(numberToCents(-1.15)).toBe(-115)
  })

  it("returns null for a cell that is not a number", () => {
    expect(numberToCents("n/d")).toBeNull()
    expect(numberToCents(null)).toBeNull()
    expect(numberToCents(Number.NaN)).toBeNull()
  })
})

describe("cellToUtcMidnight", () => {
  it("keeps the day the cell shows", () => {
    const cell = new Date(Date.UTC(2026, 6, 15, 12, 30))
    expect(cellToUtcMidnight(cell)?.toISOString()).toBe(
      "2026-07-15T00:00:00.000Z"
    )
  })

  it("keeps a late-evening payment on its own day", () => {
    const cell = new Date(Date.UTC(2026, 6, 15, 23, 50))
    expect(cellToUtcMidnight(cell)?.toISOString()).toBe(
      "2026-07-15T00:00:00.000Z"
    )
  })

  it("returns null for a cell that is not a date", () => {
    expect(cellToUtcMidnight("15/07/2026")).toBeNull()
    expect(cellToUtcMidnight(null)).toBeNull()
    expect(cellToUtcMidnight(new Date(Number.NaN))).toBeNull()
  })
})
