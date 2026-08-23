import { describe, expect, it } from "vitest"

import { balanceCents } from "@/lib/services/finance/balance"

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe("balanceCents", () => {
  it("is the opening balance when nothing has moved", () => {
    expect(balanceCents(120000, day("2026-01-01"), [])).toBe(120000)
  })

  it("adds what came in and subtracts what went out", () => {
    expect(
      balanceCents(100000, day("2026-01-01"), [
        { date: day("2026-01-05"), amountCents: -4230 },
        { date: day("2026-01-06"), amountCents: 20000 },
      ])
    ).toBe(115770)
  })

  it("counts a movement dated the opening day itself", () => {
    expect(
      balanceCents(100000, day("2026-01-01"), [
        { date: day("2026-01-01"), amountCents: -1000 },
      ])
    ).toBe(99000)
  })

  it("ignores a movement before the opening balance, which already contains it", () => {
    expect(
      balanceCents(100000, day("2026-01-01"), [
        { date: day("2025-12-31"), amountCents: -1000 },
      ])
    ).toBe(100000)
  })

  it("handles a negative opening balance", () => {
    expect(
      balanceCents(-5000, day("2026-01-01"), [
        { date: day("2026-01-02"), amountCents: 8000 },
      ])
    ).toBe(3000)
  })
})
