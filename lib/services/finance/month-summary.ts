import { db } from "@/lib/db"
import { addMonths, monthEndFor } from "@/lib/month"
import { visibleTo } from "@/lib/services/finance/access"
import {
  meanOf,
  outgoingsByCategory,
  totalsOf,
} from "@/lib/services/finance/summary"

// Three months of history behind the one on screen — the comparison of the
// design document section 8.3.
const COMPARISON_MONTHS = 3

const UNCATEGORISED = "Da categorizzare"

export type MonthCategory = {
  categoryId: string | null
  name: string
  cents: number
  // Null when no earlier month holds any data at all: there is nothing to
  // compare against yet, and a mean of nothing would read as "you usually
  // spend zero".
  meanCents: number | null
}

export type MonthSummary = {
  monthStart: Date
  incomeCents: number
  outgoingsCents: number
  uncategorisedCount: number
  categories: MonthCategory[]
}

type MonthRow = {
  amountCents: number
  categoryId: string | null
  category: { name: string; kind: "EXPENSE" | "INCOME" | "TRANSFER" } | null
}

async function rowsIn(actorId: string, monthStart: Date): Promise<MonthRow[]> {
  return db.movement.findMany({
    where: {
      account: visibleTo(actorId),
      date: { gte: monthStart, lte: monthEndFor(monthStart) },
    },
    select: {
      amountCents: true,
      categoryId: true,
      category: { select: { name: true, kind: true } },
    },
  })
}

const countable = (rows: readonly MonthRow[]) =>
  rows.map((row) => ({
    amountCents: row.amountCents,
    categoryId: row.categoryId,
    categoryKind: row.category?.kind ?? null,
  }))

/**
 * What a month came to, and how each category compares with the three before.
 *
 * @param actorId - the user id, from the session
 * @param monthStart - the first of the month, at midnight UTC
 * @returns income, outgoings, how much is still uncategorised, and the split of
 *   spending by category with its mean
 */
export async function monthSummary(
  actorId: string,
  monthStart: Date
): Promise<MonthSummary> {
  const current = await rowsIn(actorId, monthStart)

  const names = new Map(
    current.flatMap((row) =>
      row.categoryId === null || row.category === null
        ? []
        : [[row.categoryId, row.category.name] as const]
    )
  )

  const earlier = await Promise.all(
    Array.from({ length: COMPARISON_MONTHS }, (_, index) =>
      rowsIn(actorId, addMonths(monthStart, -(index + 1)))
    )
  )

  // Each earlier month is split once, not once per category: the alternative
  // re-walks every month for every row on screen.
  const history = earlier.map((month) =>
    month.length === 0 ? null : outgoingsByCategory(countable(month))
  )

  const historyFor = (categoryId: string | null) =>
    history.map(
      (month) =>
        month?.find((entry) => entry.categoryId === categoryId)?.cents ??
        (month === null ? null : 0)
    )

  const totals = totalsOf(countable(current))

  return {
    monthStart,
    incomeCents: totals.incomeCents,
    outgoingsCents: totals.outgoingsCents,
    uncategorisedCount: totals.uncategorisedCount,
    categories: outgoingsByCategory(countable(current)).map((entry) => ({
      categoryId: entry.categoryId,
      name:
        entry.categoryId === null
          ? UNCATEGORISED
          : (names.get(entry.categoryId) ?? UNCATEGORISED),
      cents: entry.cents,
      meanCents: meanOf(historyFor(entry.categoryId)),
    })),
  }
}
