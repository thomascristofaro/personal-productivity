// Every provider writes the same two facts differently, and every one of those
// spellings has a way of being read wrongly rather than not at all. Both
// functions therefore return null instead of guessing: an unreadable row is
// counted and shown, and a row read as zero would be a lie.

const AMOUNT_SHAPE = /^[+-]?\d+(?:[.,]\d+)*$/

/**
 * Reads an amount as integer cents.
 *
 * @param raw - the field as the file wrote it
 * @returns the amount in cents, negative for an outgoing, or null when the
 *   field is not an amount
 */
export function amountToCents(raw: string): number | null {
  // The unicode minus, the euro sign and every kind of space. Anything left
  // that is not a digit, a separator or a sign fails the shape below.
  const cleaned = raw.replace(/−/g, "-").replace(/[€\s ]/g, "")
  if (cleaned === "" || !AMOUNT_SHAPE.test(cleaned)) return null

  const sign = cleaned.startsWith("-") ? -1 : 1
  const digits = cleaned.replace(/^[+-]/, "")

  const lastDot = digits.lastIndexOf(".")
  const lastComma = digits.lastIndexOf(",")
  const lastSeparator = Math.max(lastDot, lastComma)

  let whole = digits
  let fraction = ""

  if (lastSeparator !== -1) {
    const tail = digits.slice(lastSeparator + 1)
    // Two kinds of separator settle it on their own: only the last one can be
    // the decimal. With one kind, three digits after it is a thousands group —
    // 1.234 is one thousand two hundred, and 12.34 is twelve euro thirty-four.
    const bothKinds = lastDot !== -1 && lastComma !== -1
    if (bothKinds || tail.length !== 3) {
      whole = digits.slice(0, lastSeparator)
      fraction = tail
    }
  }

  const wholeDigits = whole.replace(/[.,]/g, "") || "0"
  // Rounded on the fraction alone: multiplying euros by 100 in binary floating
  // point loses a cent on roughly every third amount.
  const fractionCents =
    fraction === "" ? 0 : Math.round(Number(`0.${fraction}`) * 100)

  return sign * (Number(wholeDigits) * 100 + fractionCents)
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})/
// Four digits before two in the year alternation: the other order matches "20"
// of "2026" and dates every Italian file twenty years early.
const ITALIAN = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})/

/**
 * Reads a calendar date as midnight UTC, the convention `@db.Date` columns use.
 *
 * @param raw - the field as the file wrote it, with or without a time
 * @returns the date at midnight UTC, or null when the field is not a date
 */
export function dateToUtcMidnight(raw: string): Date | null {
  const trimmed = raw.trim()

  const iso = ISO.exec(trimmed)
  if (iso !== null) {
    return build(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  }

  const italian = ITALIAN.exec(trimmed)
  if (italian !== null) {
    const year = Number(italian[3])
    return build(
      year < 100 ? 2000 + year : year,
      Number(italian[2]),
      Number(italian[1])
    )
  }

  return null
}

function build(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day))
  // Date.UTC rolls 31 June into 1 July without complaining. Comparing back is
  // what turns a typo in a file into an unreadable row rather than a movement
  // dated a day that never happened.
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null
}
