import { APP_TIMEZONE } from "@/lib/config"

const zonedParts = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
})

const KEY = /^(\d{4})-(\d{2})$/

/**
 * The first day of the month an instant falls in, at midnight UTC.
 *
 * Which month a moment belongs to depends on where the users are, never on
 * where the server is — the same rule as lib/week.ts.
 *
 * @param instant - any moment
 * @returns the first of that month, at midnight UTC
 */
export function monthStartFor(instant: Date): Date {
  const parts = new Map(
    zonedParts.formatToParts(instant).map((part) => [part.type, part.value])
  )

  return new Date(
    Date.UTC(Number(parts.get("year")), Number(parts.get("month")) - 1, 1)
  )
}

/**
 * The month as the address bar carries it.
 *
 * @param monthStart - the first of a month, at midnight UTC
 * @returns the key, for example "2026-08"
 */
export function monthKeyOf(monthStart: Date): string {
  const month = String(monthStart.getUTCMonth() + 1).padStart(2, "0")
  return `${monthStart.getUTCFullYear()}-${month}`
}

/**
 * Reads a month key from the address bar.
 *
 * @param key - the search param, as Next delivered it
 * @returns the first of that month at midnight UTC, or null when the key is not
 *   a month
 */
export function monthFromKey(key: string): Date | null {
  const match = KEY.exec(key.trim())
  if (match === null) return null

  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null

  return new Date(Date.UTC(year, month - 1, 1))
}

/**
 * Steps a month forwards or backwards.
 *
 * @param monthStart - the first of a month, at midnight UTC
 * @param delta - how many months to move; negative goes back
 * @returns the first of the resulting month
 */
export function addMonths(monthStart: Date, delta: number): Date {
  return new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + delta, 1)
  )
}

/**
 * The last day of a month, so a date range can be written with `lte`.
 *
 * A `@db.Date` column holds a day, not an instant, so the alternative — "before
 * the first of next month" — would be right too but reads as if it might drop
 * the last day.
 *
 * @param monthStart - the first of a month, at midnight UTC
 * @returns its last day, at midnight UTC
 */
export function monthEndFor(monthStart: Date): Date {
  return new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)
  )
}
