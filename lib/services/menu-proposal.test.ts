import { describe, expect, it } from "vitest"

import { DuplicateProposalError, resolveProposal } from "./menu-proposal"

const byNumber = new Map([
  [1, "recipe-one"],
  [2, "recipe-two"],
])

describe("resolveProposal", () => {
  it("maps a candidate number to its recipe id", () => {
    const slots = resolveProposal(
      { slots: [{ day: 0, meal: "LUNCH", candidate: 2 }] },
      byNumber
    )

    expect(slots).toEqual([{ day: 0, meal: "LUNCH", recipeId: "recipe-two" }])
  })

  it("drops an empty slot instead of inventing a recipe for it", () => {
    const slots = resolveProposal(
      {
        slots: [
          { day: 0, meal: "LUNCH", candidate: null },
          { day: 0, meal: "DINNER", candidate: 1 },
        ],
      },
      byNumber
    )

    expect(slots).toHaveLength(1)
    expect(slots[0].meal).toBe("DINNER")
  })

  it("throws when the same recipe is proposed twice in the week", () => {
    expect(() =>
      resolveProposal(
        {
          slots: [
            { day: 0, meal: "LUNCH", candidate: 1 },
            { day: 3, meal: "DINNER", candidate: 1 },
          ],
        },
        byNumber
      )
    ).toThrow(DuplicateProposalError)
  })

  it("allows the same recipe in two different weeks", () => {
    // Distinctness is a within-week rule, not a global one — design section 5.
    const first = resolveProposal(
      { slots: [{ day: 0, meal: "LUNCH", candidate: 1 }] },
      byNumber
    )
    const second = resolveProposal(
      { slots: [{ day: 0, meal: "LUNCH", candidate: 1 }] },
      byNumber
    )

    expect(first[0].recipeId).toBe(second[0].recipeId)
  })

  it("throws when a number has no candidate behind it", () => {
    expect(() =>
      resolveProposal(
        { slots: [{ day: 0, meal: "LUNCH", candidate: 9 }] },
        byNumber
      )
    ).toThrow()
  })

  it("returns nothing for a proposal with no filled slots", () => {
    expect(resolveProposal({ slots: [] }, byNumber)).toEqual([])
  })

  it("keeps both meals of a day, which are two slots and not a duplicate", () => {
    const slots = resolveProposal(
      {
        slots: [
          { day: 2, meal: "LUNCH", candidate: 1 },
          { day: 2, meal: "DINNER", candidate: 2 },
        ],
      },
      byNumber
    )

    expect(slots).toHaveLength(2)
  })
})
