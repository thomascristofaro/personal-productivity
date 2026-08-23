import { describe, expect, it } from "vitest"

import {
  categorise,
  type MatchableRule,
  suggestPattern,
} from "@/lib/services/finance/categorise"

const rule = (over: Partial<MatchableRule> = {}): MatchableRule => ({
  id: "r1",
  kind: "DESCRIPTION_CONTAINS",
  pattern: "esselunga",
  categoryId: "spesa",
  priority: 0,
  accountId: null,
  ...over,
})

const movement = {
  accountId: "acc",
  description: "Pagamento POS — ESSELUNGA SPA, MILANO",
  providerCategory: "Groceries",
}

describe("categorise", () => {
  it("matches a description regardless of case", () => {
    expect(categorise([rule()], movement)).toEqual({
      categoryId: "spesa",
      source: "RULE",
      ruleId: "r1",
    })
  })

  it("matches a pattern written with odd spacing", () => {
    expect(
      categorise([rule({ pattern: "  ESSELUNGA  " })], movement)?.categoryId
    ).toBe("spesa")
  })

  it("prefers a description rule over the provider's own category", () => {
    // The owner wrote the description rule looking at a real case. A specific
    // fact beats a general one, whatever the priorities say.
    const rules = [
      rule({
        id: "map",
        kind: "PROVIDER_CATEGORY_IS",
        pattern: "Groceries",
        categoryId: "altro",
        priority: -100,
      }),
      rule(),
    ]

    expect(categorise(rules, movement)?.categoryId).toBe("spesa")
  })

  it("falls back to the provider's category when no description matches", () => {
    const rules = [
      rule({ pattern: "coop" }),
      rule({
        id: "map",
        kind: "PROVIDER_CATEGORY_IS",
        pattern: "groceries",
        categoryId: "spesa",
      }),
    ]

    expect(categorise(rules, movement)).toEqual({
      categoryId: "spesa",
      source: "PROVIDER_MAP",
      ruleId: "map",
    })
  })

  it("takes the lowest priority first within a kind", () => {
    const rules = [
      rule({
        id: "late",
        pattern: "pagamento",
        categoryId: "altro",
        priority: 5,
      }),
      rule({
        id: "early",
        pattern: "esselunga",
        categoryId: "spesa",
        priority: 1,
      }),
    ]

    expect(categorise(rules, movement)?.ruleId).toBe("early")
  })

  it("ignores a rule scoped to another account", () => {
    expect(categorise([rule({ accountId: "other" })], movement)).toBeNull()
  })

  it("applies a rule scoped to this account", () => {
    expect(categorise([rule({ accountId: "acc" })], movement)?.categoryId).toBe(
      "spesa"
    )
  })

  it("returns null when nothing matches", () => {
    expect(categorise([rule({ pattern: "coop" })], movement)).toBeNull()
  })

  it("returns null for a movement whose provider declared nothing", () => {
    const rules = [rule({ kind: "PROVIDER_CATEGORY_IS", pattern: "groceries" })]
    expect(categorise(rules, { ...movement, providerCategory: null })).toBeNull()
  })

  it("matches the provider's category whole, not as a substring", () => {
    // "Bar" must not match "Barber". A description rule is a substring on
    // purpose; a declared category is a value.
    const rules = [rule({ kind: "PROVIDER_CATEGORY_IS", pattern: "Grocer" })]
    expect(categorise(rules, movement)).toBeNull()
  })
})

describe("suggestPattern", () => {
  it("picks the name out of a bank's boilerplate", () => {
    expect(suggestPattern("Pagamento POS — ESSELUNGA SPA, MILANO")).toBe(
      "ESSELUNGA"
    )
  })

  it("keeps a one-word description", () => {
    expect(suggestPattern("Netflix")).toBe("NETFLIX")
  })

  it("skips the words every statement uses", () => {
    expect(suggestPattern("Payment from Thomas")).toBe("THOMAS")
  })

  it("ignores short words, which are never the shop", () => {
    expect(suggestPattern("Bonifico a IL BAR")).toBe("BONIFICO A IL BAR")
  })

  it("gives back the whole description when nothing stands out", () => {
    // Better than an empty field: the owner edits a suggestion, and an empty
    // one suggests the feature is broken.
    expect(suggestPattern("pos carta")).toBe("POS CARTA")
  })
})
