import { describe, expect, it } from "vitest"

import { menuProposalSchema } from "./menu-proposal"

const slot = (
  day: number,
  meal: "LUNCH" | "DINNER",
  candidate: number | null
) => ({ day, meal, candidate })

describe("menuProposalSchema", () => {
  it("accepts a slot pointing at a candidate in range", () => {
    const parsed = menuProposalSchema(30).safeParse({
      slots: [slot(0, "LUNCH", 12)],
    })

    expect(parsed.success).toBe(true)
  })

  it("accepts an empty slot, because the model may decline to fill one", () => {
    const parsed = menuProposalSchema(30).safeParse({
      slots: [slot(0, "LUNCH", null)],
    })

    expect(parsed.success).toBe(true)
  })

  it("rejects a candidate above the count, which is how a hallucination arrives", () => {
    const parsed = menuProposalSchema(30).safeParse({
      slots: [slot(0, "LUNCH", 31)],
    })

    expect(parsed.success).toBe(false)
  })

  it("rejects candidate zero, because candidates are numbered from one", () => {
    const parsed = menuProposalSchema(30).safeParse({
      slots: [slot(0, "LUNCH", 0)],
    })

    expect(parsed.success).toBe(false)
  })

  it("rejects a non-integer candidate", () => {
    const parsed = menuProposalSchema(30).safeParse({
      slots: [slot(0, "LUNCH", 1.5)],
    })

    expect(parsed.success).toBe(false)
  })

  it("rejects a day outside the week", () => {
    const parsed = menuProposalSchema(30).safeParse({
      slots: [slot(7, "LUNCH", 1)],
    })

    expect(parsed.success).toBe(false)
  })

  it("rejects a meal that is not one of the two", () => {
    const parsed = menuProposalSchema(30).safeParse({
      slots: [{ day: 0, meal: "BRUNCH", candidate: 1 }],
    })

    expect(parsed.success).toBe(false)
  })
})
