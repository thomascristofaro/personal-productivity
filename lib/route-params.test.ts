import { describe, expect, it } from "vitest"

import { decodeSegment } from "@/lib/route-params"

describe("decodeSegment", () => {
  it("decodes a name the router percent-encoded", () => {
    expect(decodeSegment("aceto%20balsamico")).toBe("aceto balsamico")
  })

  it("leaves a name that needed no encoding alone", () => {
    expect(decodeSegment("arance")).toBe("arance")
  })

  it("decodes a literal percent sign back to itself", () => {
    expect(decodeSegment("sconto%2050%25")).toBe("sconto 50%")
  })

  it("returns null for a malformed escape", () => {
    // A route segment is a public endpoint: anything can be typed into the
    // address bar. Without this the page would throw a URIError and answer 500
    // where it means 404.
    expect(decodeSegment("%zz")).toBeNull()
  })
})
