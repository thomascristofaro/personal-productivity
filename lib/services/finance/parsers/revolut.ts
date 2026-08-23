import { splitCsv } from "@/lib/services/finance/csv"
import {
  type ParsedMovement,
  type ReadResult,
  UnrecognisedFileError,
} from "@/lib/services/finance/parsers/types"
import { amountToCents, dateToUtcMidnight } from "@/lib/services/finance/values"

// The columns this reader needs. Correcting the reader against a real export is
// editing this list and the fixture in the test, and nothing else.
const REQUIRED = [
  "Completed Date",
  "Description",
  "Amount",
  "Fee",
  "State",
  "Type",
] as const

/**
 * Reads a Revolut account statement export.
 *
 * @param text - the whole CSV file
 * @returns the movements it holds, with what was read and what could not be
 * @throws UnrecognisedFileError when the header is not Revolut's
 */
export function readRevolut(text: string): ReadResult {
  const rows = splitCsv(text)
  const header = rows[0] ?? []
  const index = new Map(header.map((name, position) => [name.trim(), position]))

  if (REQUIRED.some((name) => !index.has(name))) {
    throw new UnrecognisedFileError(REQUIRED, header)
  }

  const at = (row: string[], name: string) =>
    (row[index.get(name) ?? -1] ?? "").trim()

  const movements: ParsedMovement[] = []
  let unreadable = 0
  const data = rows.slice(1)

  for (const row of data) {
    // Anything else may still be reverted, and a reverted payment that was
    // imported is money the summary says was spent and never was.
    if (at(row, "State") !== "COMPLETED") continue

    const date = dateToUtcMidnight(at(row, "Completed Date"))
    const amountCents = amountToCents(at(row, "Amount"))
    const description = at(row, "Description")

    if (date === null || amountCents === null || description === "") {
      unreadable++
      continue
    }

    movements.push({
      date,
      amountCents,
      providerCategory: at(row, "Type") || null,
      providerRef: null,
      description,
    })

    // A fee is a real outgoing. Folding it into the amount beside it would make
    // the payment look bigger than it was and the fee disappear as a line.
    const feeCents = amountToCents(at(row, "Fee"))
    if (feeCents !== null && feeCents !== 0) {
      movements.push({
        date,
        amountCents: -Math.abs(feeCents),
        description: `Commissione — ${description}`,
        providerCategory: "FEE",
        providerRef: null,
      })
    }
  }

  return { movements, rowsRead: data.length, unreadable }
}
