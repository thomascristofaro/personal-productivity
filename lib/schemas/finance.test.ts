import { describe, expect, it } from "vitest"

import {
  FinanceAccountInputSchema,
  MovementNoteSchema,
  RuleInputSchema,
  SignedEuroCentsSchema,
} from "@/lib/schemas/finance"

describe("SignedEuroCentsSchema", () => {
  it("reads a plain amount", () => {
    expect(SignedEuroCentsSchema.parse("12,34")).toBe(1234)
  })

  it("reads a negative balance, which a current account can have", () => {
    expect(SignedEuroCentsSchema.parse("-12,34")).toBe(-1234)
  })

  it("accepts a dot, because a numeric keypad gives one", () => {
    expect(SignedEuroCentsSchema.parse("12.34")).toBe(1234)
  })

  it("treats an empty field as zero", () => {
    expect(SignedEuroCentsSchema.parse("")).toBe(0)
  })

  it("refuses a thousands separator rather than guessing at it", () => {
    expect(SignedEuroCentsSchema.safeParse("1.234,56").success).toBe(false)
  })

  it("refuses something that is not a number", () => {
    expect(SignedEuroCentsSchema.safeParse("boh").success).toBe(false)
  })
})

describe("FinanceAccountInputSchema", () => {
  // Keyed as the schema is, not as the form is: the field arrives as a typed
  // string and leaves as cents, and the action is what maps the form's
  // `openingBalance` onto it.
  const valid = {
    name: "Revolut",
    provider: "REVOLUT",
    shared: false,
    openingBalanceCents: "1200,00",
    openingBalanceAt: "2026-01-01",
  }

  it("accepts a filled-in form", () => {
    expect(FinanceAccountInputSchema.parse(valid).openingBalanceCents).toBe(
      120000
    )
  })

  it("refuses an empty name", () => {
    expect(
      FinanceAccountInputSchema.safeParse({ ...valid, name: " " }).success
    ).toBe(false)
  })

  it("refuses a provider that has no reader", () => {
    expect(
      FinanceAccountInputSchema.safeParse({ ...valid, provider: "PAYPAL" })
        .success
    ).toBe(false)
  })

  it("refuses a date that is not a date", () => {
    expect(
      FinanceAccountInputSchema.safeParse({
        ...valid,
        openingBalanceAt: "boh",
      }).success
    ).toBe(false)
  })
})

describe("MovementNoteSchema", () => {
  it("turns an emptied field into null, which is how the column says it", () => {
    expect(MovementNoteSchema.parse("   ")).toBeNull()
  })

  it("keeps a note", () => {
    expect(MovementNoteSchema.parse(" rimborso di Marco ")).toBe(
      "rimborso di Marco"
    )
  })

  it("refuses a note longer than the column expects", () => {
    expect(MovementNoteSchema.safeParse("x".repeat(501)).success).toBe(false)
  })
})

describe("RuleInputSchema", () => {
  const valid = {
    kind: "DESCRIPTION_CONTAINS",
    pattern: "ESSELUNGA",
    categoryId: "cmt5jj0d8000bw0pfc1kl0yqd",
    accountId: "",
  }

  it("reads an empty account as every account", () => {
    expect(RuleInputSchema.parse(valid).accountId).toBeNull()
  })

  it("keeps an account when one is chosen", () => {
    expect(
      RuleInputSchema.parse({
        ...valid,
        accountId: "cmt5jhdxs0000w0pfpuhad789",
      }).accountId
    ).toBe("cmt5jhdxs0000w0pfpuhad789")
  })

  it("refuses a one-character pattern, which would match everything", () => {
    expect(RuleInputSchema.safeParse({ ...valid, pattern: "a" }).success).toBe(
      false
    )
  })

  it("refuses an account id that is not an id", () => {
    expect(RuleInputSchema.safeParse({ ...valid, accountId: "boh" }).success).toBe(
      false
    )
  })
})
