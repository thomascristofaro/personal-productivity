import { describe, expect, it } from "vitest"

import { offsetFrom } from "@/lib/services/finance/movements"

describe("offsetFrom", () => {
  it("starts at zero when the address says nothing", () => {
    expect(offsetFrom(undefined)).toBe(0)
  })

  it("reads a number the address carries", () => {
    expect(offsetFrom("50")).toBe(50)
  })

  it("ignores a negative offset rather than paging backwards off the end", () => {
    expect(offsetFrom("-10")).toBe(0)
  })

  it("ignores something that is not a number", () => {
    expect(offsetFrom("boh")).toBe(0)
  })

  it("caps an absurd offset, so a hand-typed address cannot ask for a scan", () => {
    expect(offsetFrom("999999999")).toBe(100000)
  })

  it("floors a fractional offset", () => {
    expect(offsetFrom("50.7")).toBe(50)
  })
})
