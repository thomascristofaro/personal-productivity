import type { CategoryKind } from "@/lib/schemas/finance"

export type CountableRow = {
  amountCents: number
  categoryId: string | null
  categoryKind: CategoryKind | null
}

/**
 * Whether a movement belongs in income and outgoings.
 *
 * The one place the transfer exclusion of the design document section 8.2 is
 * written. A transfer is neither: the money moved between two pockets that are
 * both yours. It still counts towards a balance — that is a different question
 * and a different function.
 *
 * A movement with no category counts. It is real money, and dropping it would
 * make every total quietly small.
 *
 * @param kind - the movement's category kind, or null when it has none
 * @returns true when it belongs in the totals
 */
export function countsTowardsTotals(kind: CategoryKind | null): boolean {
  return kind !== "TRANSFER"
}

/**
 * What a set of movements came to.
 *
 * @param rows - the movements of one month, over the visible accounts
 * @returns income and outgoings in cents — outgoings negative, as stored — and
 *   how many rows still have no category
 */
export function totalsOf(rows: readonly CountableRow[]): {
  incomeCents: number
  outgoingsCents: number
  uncategorisedCount: number
} {
  let incomeCents = 0
  let outgoingsCents = 0
  let uncategorisedCount = 0

  for (const row of rows) {
    if (row.categoryId === null) uncategorisedCount++
    if (!countsTowardsTotals(row.categoryKind)) continue

    if (row.amountCents >= 0) incomeCents += row.amountCents
    else outgoingsCents += row.amountCents
  }

  return { incomeCents, outgoingsCents, uncategorisedCount }
}

/**
 * The month's spending, split by category, biggest first.
 *
 * @param rows - the movements of one month, over the visible accounts
 * @returns one entry per category that was spent on; null groups the ones with
 *   no category yet
 */
export function outgoingsByCategory(
  rows: readonly CountableRow[]
): { categoryId: string | null; cents: number }[] {
  const totals = new Map<string | null, number>()

  for (const row of rows) {
    if (!countsTowardsTotals(row.categoryKind)) continue
    if (row.amountCents >= 0) continue

    totals.set(
      row.categoryId,
      (totals.get(row.categoryId) ?? 0) + row.amountCents
    )
  }

  return [...totals.entries()]
    .map(([categoryId, cents]) => ({ categoryId, cents }))
    .sort((a, b) => a.cents - b.cents)
}

/**
 * The average of the months that have anything to say.
 *
 * A null is a month with no movements at all — before the first import, say —
 * and averaging it as a zero would drag every comparison down and make this
 * month look worse than it is. A month that really spent nothing on a category
 * is a zero and does count.
 *
 * @param values - one entry per month, null when the month holds no data
 * @returns the mean in whole cents, or null when no month has data
 */
export function meanOf(values: readonly (number | null)[]): number | null {
  const known = values.filter((value) => value !== null)
  if (known.length === 0) return null

  const total = known.reduce((sum, value) => sum + value, 0)
  return Math.round(total / known.length)
}
