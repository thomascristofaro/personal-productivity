import { describe, expect, it } from "vitest"

import { dateForDay, dayIndexFor, weekStartFor } from "@/lib/week"

const iso = (date: Date) => date.toISOString().slice(0, 10)

describe("weekStartFor", () => {
  it("returns the Monday of the week a Thursday falls in", () => {
    expect(iso(weekStartFor(new Date("2026-08-13T12:00:00Z")))).toBe(
      "2026-08-10"
    )
  })

  it("returns the same day for a Monday", () => {
    expect(iso(weekStartFor(new Date("2026-08-10T12:00:00Z")))).toBe(
      "2026-08-10"
    )
  })

  it("keeps Sunday in the week that began six days earlier", () => {
    expect(iso(weekStartFor(new Date("2026-08-16T12:00:00Z")))).toBe(
      "2026-08-10"
    )
  })

  it("uses the app timezone, not UTC, to decide which week a moment is in", () => {
    // 23:30 UTC on Sunday is already 01:30 on Monday in Rome, so this instant
    // belongs to the week starting 2026-08-10, not the one before it.
    expect(iso(weekStartFor(new Date("2026-08-09T23:30:00Z")))).toBe(
      "2026-08-10"
    )
  })

  it("returns midnight UTC, so the value is a date and not an instant", () => {
    expect(weekStartFor(new Date("2026-08-13T12:00:00Z")).toISOString()).toBe(
      "2026-08-10T00:00:00.000Z"
    )
  })
})

describe("dayIndexFor", () => {
  it("numbers Monday zero", () => {
    expect(dayIndexFor(new Date("2026-08-10T12:00:00Z"))).toBe(0)
  })

  it("numbers Sunday six", () => {
    expect(dayIndexFor(new Date("2026-08-16T12:00:00Z"))).toBe(6)
  })
})

describe("dateForDay", () => {
  it("maps day six of a week onto its Sunday", () => {
    expect(iso(dateForDay(new Date("2026-08-10T00:00:00Z"), 6))).toBe(
      "2026-08-16"
    )
  })

  it("does not mutate the week start it is given", () => {
    const weekStart = new Date("2026-08-10T00:00:00Z")
    dateForDay(weekStart, 3)
    expect(iso(weekStart)).toBe("2026-08-10")
  })
})
