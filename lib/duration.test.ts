import { describe, expect, it } from "vitest"

import { minutesFromDuration } from "@/lib/duration"

describe("minutesFromDuration", () => {
  it("reads the minutes a recipe site publishes", () => {
    expect(minutesFromDuration("PT25M")).toBe(25)
  })

  it("adds the hours", () => {
    expect(minutesFromDuration("PT1H30M")).toBe(90)
  })

  it("reads a duration written with a zero day part", () => {
    expect(minutesFromDuration("P0DT30M")).toBe(30)
  })

  it("returns null for a duration that adds up to nothing", () => {
    // "P" alone matches the shape and means no time at all. Zero minutes is
    // not a cooking time, and an empty field reads better than "0".
    expect(minutesFromDuration("P")).toBeNull()
  })

  it("returns null for anything that is not a duration", () => {
    expect(minutesFromDuration("mezz'ora")).toBeNull()
    expect(minutesFromDuration(undefined)).toBeNull()
    expect(minutesFromDuration(45)).toBeNull()
  })
})
