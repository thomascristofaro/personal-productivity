import { aisleRank } from "@/lib/aisles"
import type { StoredItem } from "@/lib/services/shopping-lists"

/** One line as the screen shows it: several stored rows seen as one thing. */
export type MergedLine = {
  // Derived from the name and the unit, so it survives a regeneration giving
  // every row a new id — which is what lets React keep the checkbox it was
  // already rendering rather than remount it mid-tap.
  key: string
  ids: string[]
  // The subset added by hand. The bin removes these and leaves the rest, so
  // deleting your own 200 g does not remove what the menu still needs.
  manualIds: string[]
  name: string
  quantity: number | null
  unit: string | null
  aisle: string
  days: number[]
  checked: boolean
}

export type AisleGroup = { aisle: string; lines: MergedLine[] }

// JSON rather than string concatenation, so a name containing the separator
// cannot forge another line's key and a null unit stays distinct from "". The
// same encoding the aggregator keys on, for the same reason.
const lineKey = (name: string, unit: string | null) =>
  JSON.stringify([name, unit])

/**
 * Unites the rows that stand for one thing into the lines the screen shows.
 *
 * The database deliberately keeps them apart: a regeneration deletes the
 * generated rows and rebuilds them, and a hand-added 200 g of tomatoes has to
 * survive that. Merging here rather than on the way in is what lets both be
 * true, and it means regeneration needs to know nothing about this rule — see
 * section 6 of the design document of 2026-08-18, which fixes every case below.
 *
 * Pure: no database, no state, and stable for a given input.
 *
 * @param items Every row of the list, in any order.
 * @returns One line per name and unit, in the order the names first appeared.
 */
export function mergeLines(items: StoredItem[]): MergedLine[] {
  const lines = new Map<string, MergedLine>()

  for (const row of items) {
    const key = lineKey(row.name, row.unit)
    const line = lines.get(key)

    if (line === undefined) {
      lines.set(key, {
        key,
        ids: [row.id],
        manualIds: row.manual ? [row.id] : [],
        name: row.name,
        quantity: row.quantity,
        unit: row.unit,
        aisle: row.aisle,
        days: [...row.days],
        checked: row.checked,
      })
      continue
    }

    line.ids.push(row.id)
    if (row.manual) line.manualIds.push(row.id)
    if (row.quantity !== null) {
      line.quantity = (line.quantity ?? 0) + row.quantity
    }
    for (const day of row.days) {
      if (!line.days.includes(day)) line.days.push(day)
    }
    // A tick means "I have this". Half of it ticked means the line is not done.
    line.checked = line.checked && row.checked
    // Two rows for one name should agree on the aisle, and in every real case
    // do. When they do not the earlier one wins: finding a thing too early in
    // the shop costs a moment, finding it too late costs the walk back.
    if (aisleRank(row.aisle) < aisleRank(line.aisle)) line.aisle = row.aisle
  }

  return [...lines.values()].map((line) => ({
    ...line,
    days: [...line.days].sort((a, b) => a - b),
    // Summing floats introduces noise the shopper should never read:
    // 0.1 + 0.2 is 0.30000000000000004.
    quantity:
      line.quantity === null ? null : Math.round(line.quantity * 100) / 100,
  }))
}

/**
 * Gathers the lines into the aisles of the supermarket walking order.
 *
 * Sorts as well as groups, because the rows arrive from Postgres in whatever
 * order it liked and no SQL `ORDER BY` can express a walking order that is not
 * alphabetical. Moved here from shopping-lists.ts when that file grew to two
 * jobs — talking to the database, and shaping a list for a screen.
 *
 * @param lines Every line of the list, already merged.
 * @returns One group per aisle that has lines, in walking order, each group's
 *   lines by name.
 */
export function groupByAisle(lines: MergedLine[]): AisleGroup[] {
  const sorted = [...lines].sort(
    (a, b) =>
      aisleRank(a.aisle) - aisleRank(b.aisle) ||
      a.name.localeCompare(b.name, "it")
  )

  const groups: AisleGroup[] = []

  for (const line of sorted) {
    const last = groups[groups.length - 1]
    // Adjacency is enough because the sort already put one aisle's lines
    // together, and it keeps an unrecognised aisle folded in with the catch-all
    // exactly the way aisleRank ranks it.
    if (last !== undefined && aisleRank(last.aisle) === aisleRank(line.aisle)) {
      last.lines.push(line)
      continue
    }
    groups.push({ aisle: line.aisle, lines: [line] })
  }

  return groups
}
