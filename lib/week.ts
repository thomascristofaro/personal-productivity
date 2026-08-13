import { APP_TIMEZONE, DAYS_IN_WEEK } from "@/lib/config"

const zonedParts = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

// The calendar date the instant falls on in the app's timezone, expressed as
// midnight UTC. Reading the parts rather than formatting a string keeps this
// independent of how any locale happens to order them.
function civilDate(instant: Date): Date {
  const parts = new Map(
    zonedParts.formatToParts(instant).map((part) => [part.type, part.value])
  )

  return new Date(
    Date.UTC(
      Number(parts.get("year")),
      Number(parts.get("month")) - 1,
      Number(parts.get("day"))
    )
  )
}

// getUTCDay() numbers Sunday zero; our weeks start on Monday.
const mondayFirst = (utcDay: number) =>
  (utcDay + DAYS_IN_WEEK - 1) % DAYS_IN_WEEK

export function weekStartFor(instant: Date): Date {
  const date = civilDate(instant)
  date.setUTCDate(date.getUTCDate() - mondayFirst(date.getUTCDay()))
  return date
}

export function dayIndexFor(instant: Date): number {
  return mondayFirst(civilDate(instant).getUTCDay())
}

export function dateForDay(weekStart: Date, day: number): Date {
  const date = new Date(weekStart)
  date.setUTCDate(date.getUTCDate() + day)
  return date
}
