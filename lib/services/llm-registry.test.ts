import { describe, expect, it } from "vitest"

import { EXECUTION_RETENTION, idsToPrune } from "./llm-registry"

describe("idsToPrune", () => {
  it("keeps everything while under the ceiling", () => {
    expect(idsToPrune(["a", "b", "c"], 20)).toEqual([])
  })

  it("keeps exactly the ceiling", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `id-${i}`)

    expect(idsToPrune(ids, 20)).toEqual([])
  })

  it("drops the oldest when one over", () => {
    // Newest first, which is the order the query returns.
    const ids = Array.from({ length: 21 }, (_, i) => `id-${i}`)

    expect(idsToPrune(ids, 20)).toEqual(["id-20"])
  })

  it("drops all the surplus at once, not one per call", () => {
    const ids = Array.from({ length: 25 }, (_, i) => `id-${i}`)

    expect(idsToPrune(ids, 20)).toHaveLength(5)
  })

  it("survives an empty history", () => {
    expect(idsToPrune([], 20)).toEqual([])
  })

  it("keeps twenty by default", () => {
    expect(EXECUTION_RETENTION).toBe(20)
  })
})
