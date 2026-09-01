import { describe, expect, it } from "vitest"

import {
  DaySchema,
  MealSchema,
  EntryInputSchema,
  WeekStartSchema,
} from "@/lib/schemas/menu"

describe("WeekStartSchema", () => {
  it("accepts a Monday and returns it as a date", () => {
    const result = WeekStartSchema.parse("2026-08-17")
    expect(result.toISOString()).toBe("2026-08-17T00:00:00.000Z")
  })

  it("rejects a day that is not a Monday, so one week cannot have two URLs", () => {
    const result = WeekStartSchema.safeParse("2026-08-19")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "La settimana deve iniziare di lunedì."
      )
    }
  })

  it("rejects a date that does not exist", () => {
    expect(WeekStartSchema.safeParse("2026-02-31").success).toBe(false)
  })

  it("rejects anything that is not a plain AAAA-MM-GG date", () => {
    expect(WeekStartSchema.safeParse("2026-08-17T00:00:00Z").success).toBe(
      false
    )
  })
})

describe("DaySchema", () => {
  it("accepts Monday as zero and Sunday as six", () => {
    expect(DaySchema.parse(0)).toBe(0)
    expect(DaySchema.parse(6)).toBe(6)
  })

  it("rejects a seventh day", () => {
    expect(DaySchema.safeParse(7).success).toBe(false)
  })

  it("rejects a fraction", () => {
    expect(DaySchema.safeParse(1.5).success).toBe(false)
  })
})

describe("MealSchema", () => {
  it("accepts the two meals", () => {
    expect(MealSchema.parse("LUNCH")).toBe("LUNCH")
    expect(MealSchema.parse("DINNER")).toBe("DINNER")
  })

  it("rejects anything else", () => {
    expect(MealSchema.safeParse("BREAKFAST").success).toBe(false)
  })
})

describe("EntryInputSchema", () => {
  const empty = { recipeId: null, freeText: null, servings: null }

  it("accepts an empty entry", () => {
    expect(EntryInputSchema.parse(empty)).toEqual(empty)
  })

  it("accepts an entry holding a recipe", () => {
    const parsed = EntryInputSchema.parse({
      ...empty,
      recipeId: "cm3xk1p2h0000abcdefghijkl",
    })
    expect(parsed.recipeId).toBe("cm3xk1p2h0000abcdefghijkl")
  })

  it("accepts an entry holding a note", () => {
    expect(
      EntryInputSchema.parse({ ...empty, freeText: "fuori a cena" }).freeText
    ).toBe("fuori a cena")
  })

  it("turns a blank note into null, so it is absent rather than empty", () => {
    expect(
      EntryInputSchema.parse({ ...empty, freeText: "  " }).freeText
    ).toBeNull()
  })

  it("rejects an entry holding both a recipe and a note", () => {
    const result = EntryInputSchema.safeParse({
      recipeId: "cm3xk1p2h0000abcdefghijkl",
      freeText: "fuori a cena",
      servings: null,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Un piatto può essere una ricetta oppure una nota, non entrambe."
      )
    }
  })

  it("rejects zero servings, which would cook for nobody", () => {
    expect(EntryInputSchema.safeParse({ ...empty, servings: 0 }).success).toBe(
      false
    )
  })

  it("rejects a recipe id that is not a cuid", () => {
    expect(
      EntryInputSchema.safeParse({ ...empty, recipeId: "42" }).success
    ).toBe(false)
  })
})
