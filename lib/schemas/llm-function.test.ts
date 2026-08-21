import { describe, expect, it } from "vitest"

import { LlmFunctionInputSchema, REASONING_LEVELS } from "./llm-function"

const valid = {
  prompt: "Sei l'assistente che compone il menù.",
  model: "gemini-3.7-flash",
  temperature: 1,
  maxTokens: 4096,
  reasoning: "provider-default",
}

describe("LlmFunctionInputSchema", () => {
  it("accepts a complete input", () => {
    expect(LlmFunctionInputSchema.safeParse(valid).success).toBe(true)
  })

  it("rejects an empty prompt, which would leave the model with no instructions", () => {
    expect(
      LlmFunctionInputSchema.safeParse({ ...valid, prompt: "  " }).success
    ).toBe(false)
  })

  it("rejects an empty model name", () => {
    expect(
      LlmFunctionInputSchema.safeParse({ ...valid, model: "" }).success
    ).toBe(false)
  })

  it("rejects a temperature outside the range the API accepts", () => {
    expect(
      LlmFunctionInputSchema.safeParse({ ...valid, temperature: 3 }).success
    ).toBe(false)
    expect(
      LlmFunctionInputSchema.safeParse({ ...valid, temperature: -1 }).success
    ).toBe(false)
  })

  it("rejects a token ceiling of zero", () => {
    expect(
      LlmFunctionInputSchema.safeParse({ ...valid, maxTokens: 0 }).success
    ).toBe(false)
  })

  it("rejects a fractional token ceiling", () => {
    expect(
      LlmFunctionInputSchema.safeParse({ ...valid, maxTokens: 10.5 }).success
    ).toBe(false)
  })

  it("trims the prompt, so trailing whitespace does not count as a change", () => {
    expect(
      LlmFunctionInputSchema.parse({ ...valid, prompt: "  ciao  " }).prompt
    ).toBe("ciao")
  })

  it("accepts every level of the AI SDK's scale", () => {
    for (const level of Object.keys(REASONING_LEVELS)) {
      expect(
        LlmFunctionInputSchema.safeParse({ ...valid, reasoning: level }).success
      ).toBe(true)
    }
  })

  it("rejects a level outside it, so a stale form cannot write a bad value", () => {
    expect(
      LlmFunctionInputSchema.safeParse({ ...valid, reasoning: "turbo" }).success
    ).toBe(false)
  })

  it("reports its errors in Italian", () => {
    const parsed = LlmFunctionInputSchema.safeParse({ ...valid, prompt: "" })

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe(
        "Il prompt non può essere vuoto."
      )
    }
  })
})
