// Days, hours and minutes only. A cooking time measured in months is not a
// cooking time, and guessing at one would put a wrong number in a field the
// user then has to notice and correct.
const DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i

/**
 * The minutes in an ISO 8601 duration.
 *
 * `schema.org` publishes recipe times as `PT25M` or `PT1H30M`, and the value is
 * whatever the site chose to put there — it is not guaranteed to be a string.
 *
 * @param value - the duration, or anything else the page supplied
 * @returns the total minutes, or null when there is nothing to read
 */
export function minutesFromDuration(value: unknown): number | null {
  if (typeof value !== "string") return null

  const match = DURATION.exec(value.trim())
  if (match === null) return null

  const total =
    Number(match[1] ?? 0) * 1440 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0)

  return total > 0 ? total : null
}
