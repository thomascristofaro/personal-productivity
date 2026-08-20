import { describe, expect, it } from "vitest"

import { safeNext } from "@/lib/safe-next"

describe("safeNext", () => {
  it("keeps a relative path of ours", () => {
    expect(safeNext("/import?url=https://x.example")).toBe(
      "/import?url=https://x.example"
    )
  })

  it("refuses an absolute URL", () => {
    expect(safeNext("https://evil.example")).toBe("/menu")
  })

  it("refuses a protocol-relative URL that looks relative", () => {
    expect(safeNext("//evil.example")).toBe("/menu")
  })

  it("falls back when there is nothing to go back to", () => {
    expect(safeNext(undefined)).toBe("/menu")
  })
})
