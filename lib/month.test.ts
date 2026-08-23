import { describe, expect, it } from "vitest"

import {
  addMonths,
  monthEndFor,
  monthFromKey,
  monthKeyOf,
  monthStartFor,
} from "@/lib/month"

const iso = (date: Date | null) => date?.toISOString() ?? null

describe("monthStartFor", () => {
  it("is the first of the month the instant falls in", () => {
    expect(iso(monthStartFor(new Date("2026-08-23T09:00:00Z")))).toBe(
      "2026-08-01T00:00:00.000Z"
    )
  })

  it("uses the app's timezone, not the server's", () => {
    // 23:30 UTC on 31 July is already 1 August in Rome, so the month has
    // turned. A server in UTC deciding for itself would say July.
    expect(iso(monthStartFor(new Date("2026-07-31T23:30:00Z")))).toBe(
      "2026-08-01T00:00:00.000Z"
    )
  })
})

describe("monthKeyOf", () => {
  it("writes the month as the address bar carries it", () => {
    expect(monthKeyOf(new Date("2026-08-01T00:00:00Z"))).toBe("2026-08")
  })

  it("pads a single-digit month", () => {
    expect(monthKeyOf(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01")
  })
})

describe("monthFromKey", () => {
  it("reads a key back", () => {
    expect(iso(monthFromKey("2026-08"))).toBe("2026-08-01T00:00:00.000Z")
  })

  it("refuses a month that does not exist", () => {
    expect(monthFromKey("2026-13")).toBeNull()
  })

  it("refuses something that is not a month", () => {
    expect(monthFromKey("boh")).toBeNull()
    expect(monthFromKey("2026-8")).toBeNull()
  })
})

describe("addMonths", () => {
  it("steps backwards", () => {
    expect(iso(addMonths(new Date("2026-08-01T00:00:00Z"), -1))).toBe(
      "2026-07-01T00:00:00.000Z"
    )
  })

  it("crosses a year going back", () => {
    expect(iso(addMonths(new Date("2026-01-01T00:00:00Z"), -1))).toBe(
      "2025-12-01T00:00:00.000Z"
    )
  })

  it("steps forwards", () => {
    expect(iso(addMonths(new Date("2026-12-01T00:00:00Z"), 1))).toBe(
      "2027-01-01T00:00:00.000Z"
    )
  })
})

describe("monthEndFor", () => {
  it("is the last day of the month, so a query can use <=", () => {
    expect(iso(monthEndFor(new Date("2026-02-01T00:00:00Z")))).toBe(
      "2026-02-28T00:00:00.000Z"
    )
  })

  it("knows a leap year", () => {
    expect(iso(monthEndFor(new Date("2028-02-01T00:00:00Z")))).toBe(
      "2028-02-29T00:00:00.000Z"
    )
  })
})
