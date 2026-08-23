import { describe, expect, it } from "vitest"

import {
  type Fingerprinted,
  fingerprintOf,
  rowsToWrite,
} from "@/lib/services/finance/fingerprint"
import type { ParsedMovement } from "@/lib/services/finance/parsers/types"

const movement = (over: Partial<ParsedMovement> = {}): ParsedMovement => ({
  date: new Date("2026-07-15T00:00:00.000Z"),
  amountCents: -150,
  description: "Bar Centrale",
  providerCategory: null,
  providerRef: null,
  ...over,
})

const withPrint = (over: Partial<ParsedMovement> = {}): Fingerprinted => {
  const base = movement(over)
  return { ...base, fingerprint: fingerprintOf("acc", base) }
}

describe("fingerprintOf", () => {
  it("gives the same row the same fingerprint twice", () => {
    expect(fingerprintOf("acc", movement())).toBe(
      fingerprintOf("acc", movement())
    )
  })

  it("ignores case and spacing in the description", () => {
    expect(
      fingerprintOf("acc", movement({ description: "BAR  centrale" }))
    ).toBe(fingerprintOf("acc", movement({ description: "Bar Centrale" })))
  })

  it("separates two accounts", () => {
    expect(fingerprintOf("acc", movement())).not.toBe(
      fingerprintOf("other", movement())
    )
  })

  it("separates two amounts", () => {
    expect(fingerprintOf("acc", movement({ amountCents: -151 }))).not.toBe(
      fingerprintOf("acc", movement())
    )
  })

  it("separates two dates", () => {
    expect(
      fingerprintOf("acc", movement({ date: new Date("2026-07-16T00:00:00Z") }))
    ).not.toBe(fingerprintOf("acc", movement()))
  })

  it("separates two provider ids, which is what makes them exact", () => {
    expect(fingerprintOf("acc", movement({ providerRef: "a" }))).not.toBe(
      fingerprintOf("acc", movement({ providerRef: "b" }))
    )
  })
})

describe("rowsToWrite", () => {
  it("writes both of two identical coffees on the same day", () => {
    // The defect this module must not have. Comparing rows rather than counting
    // them deletes the second one, and a real outgoing disappears in silence.
    const file = [withPrint(), withPrint()]
    const { toWrite, skipped } = rowsToWrite(file, new Map())

    expect(toWrite).toHaveLength(2)
    expect(toWrite.map((row) => row.occurrence)).toEqual([0, 1])
    expect(skipped).toBe(0)
  })

  it("writes only the second when the first is already stored", () => {
    const file = [withPrint(), withPrint()]
    const stored = new Map([[file[0]!.fingerprint, 1]])
    const { toWrite, skipped } = rowsToWrite(file, stored)

    expect(toWrite).toHaveLength(1)
    expect(toWrite[0]?.occurrence).toBe(1)
    expect(skipped).toBe(1)
  })

  it("writes nothing when the same file is imported twice", () => {
    const file = [withPrint(), withPrint({ amountCents: -900 })]
    const stored = new Map(file.map((row) => [row.fingerprint, 1]))
    const { toWrite, skipped } = rowsToWrite(file, stored)

    expect(toWrite).toEqual([])
    expect(skipped).toBe(2)
  })

  it("continues the numbering from what is stored", () => {
    const file = [withPrint(), withPrint(), withPrint()]
    const stored = new Map([[file[0]!.fingerprint, 2]])
    const { toWrite } = rowsToWrite(file, stored)

    expect(toWrite).toHaveLength(1)
    expect(toWrite[0]?.occurrence).toBe(2)
  })

  it("counts each fingerprint on its own", () => {
    const bar = withPrint()
    const shop = withPrint({ description: "Esselunga", amountCents: -4230 })
    const { toWrite } = rowsToWrite([bar, shop], new Map([[bar.fingerprint, 1]]))

    expect(toWrite).toHaveLength(1)
    expect(toWrite[0]?.description).toBe("Esselunga")
  })
})
