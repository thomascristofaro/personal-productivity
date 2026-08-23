import { describe, expect, it } from "vitest"

import {
  pairCandidates,
  type PairableMovement,
} from "@/lib/services/finance/pairing"

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

const out = (over: Partial<PairableMovement> = {}): PairableMovement => ({
  id: "out",
  accountId: "intesa",
  date: day("2026-07-10"),
  amountCents: -20000,
  ...over,
})

const inn = (over: Partial<PairableMovement> = {}): PairableMovement => ({
  id: "in",
  accountId: "revolut",
  date: day("2026-07-11"),
  amountCents: 20000,
  ...over,
})

describe("pairCandidates", () => {
  it("pairs equal and opposite amounts on two accounts", () => {
    const { settled, contested } = pairCandidates([out(), inn()], 4)

    expect(settled).toEqual([
      { outgoingId: "out", incomingId: "in", daysApart: 1 },
    ])
    expect(contested).toEqual([])
  })

  it("pairs two legs on the same day", () => {
    const { settled } = pairCandidates(
      [out(), inn({ date: day("2026-07-10") })],
      4
    )
    expect(settled[0]?.daysApart).toBe(0)
  })

  it("does not pair two movements on the same account", () => {
    const { settled, contested } = pairCandidates(
      [out(), inn({ accountId: "intesa" })],
      4
    )
    expect(settled).toEqual([])
    expect(contested).toEqual([])
  })

  it("does not pair amounts that differ", () => {
    expect(
      pairCandidates([out(), inn({ amountCents: 19900 })], 4).settled
    ).toEqual([])
  })

  it("does not pair two outgoings", () => {
    expect(
      pairCandidates([out(), out({ id: "b", accountId: "revolut" })], 4).settled
    ).toEqual([])
  })

  it("pairs at the edge of the window", () => {
    expect(
      pairCandidates([out(), inn({ date: day("2026-07-14") })], 4).settled
    ).toHaveLength(1)
  })

  it("does not pair beyond the window", () => {
    expect(
      pairCandidates([out(), inn({ date: day("2026-07-15") })], 4).settled
    ).toEqual([])
  })

  it("pairs an incoming that came first", () => {
    // The leg that lands first is not always the one that left first.
    expect(
      pairCandidates([out(), inn({ date: day("2026-07-08") })], 4).settled
    ).toHaveLength(1)
  })

  it("contests a pair when one leg has two candidates", () => {
    // Two identical top-ups in the same week. Choosing one would be guessing,
    // and a wrong guess hides a real expense.
    const { settled, contested } = pairCandidates(
      [out(), inn(), inn({ id: "in2", date: day("2026-07-12") })],
      4
    )

    expect(settled).toEqual([])
    expect(contested).toHaveLength(2)
  })

  it("keeps an unrelated settled pair out of a contest", () => {
    const rows = [
      out(),
      inn(),
      inn({ id: "in2", date: day("2026-07-12") }),
      out({ id: "out3", amountCents: -5000, date: day("2026-07-20") }),
      inn({ id: "in3", amountCents: 5000, date: day("2026-07-20") }),
    ]

    const { settled, contested } = pairCandidates(rows, 4)

    expect(settled).toEqual([
      { outgoingId: "out3", incomingId: "in3", daysApart: 0 },
    ])
    expect(contested).toHaveLength(2)
  })

  it("ignores a movement of zero, which pairs with itself on paper", () => {
    const rows = [
      out({ id: "z1", amountCents: 0 }),
      inn({ id: "z2", amountCents: 0 }),
    ]
    expect(pairCandidates(rows, 4).settled).toEqual([])
  })
})
