import { decodeText, splitCsv } from "@/lib/services/finance/csv"
import {
  type ParsedMovement,
  type ReadResult,
  type StatementFile,
  UnrecognisedFileError,
} from "@/lib/services/finance/parsers/types"
import { amountToCents, dateToUtcMidnight } from "@/lib/services/finance/values"

// Revolut translates its export's header into the account's language, so a
// column is named by every spelling we have seen rather than by one. The
// Italian name comes first: it is what the owner's export carries, and it is
// what the screen prints when a file is refused.
//
// `State` is not a mistake in this list. It is the one column Revolut leaves in
// English in the Italian export, while translating its values — see SETTLED.
//
// The date is the one the payment was *made*, not the one it settled on: the
// two differ by up to a day on a foreign payment, and a movement belongs to the
// day it happened. Owner's decision of 2026-08-27.
const COLUMNS = {
  date: ["Data di inizio", "Started Date"],
  description: ["Descrizione", "Description"],
  amount: ["Importo", "Amount"],
  fee: ["Costo", "Fee"],
  state: ["State", "Stato"],
  kind: ["Tipo", "Type"],
} as const

const SETTLED = ["COMPLETATO", "COMPLETED"]

/**
 * Reads a Revolut account statement export.
 *
 * @param file - the whole CSV file, as bytes
 * @returns the movements it holds, with what was read and what could not be
 * @throws UnrecognisedFileError when the header is not Revolut's
 */
export async function readRevolut(file: StatementFile): Promise<ReadResult> {
  const rows = splitCsv(decodeText(file))
  const header = (rows[0] ?? []).map((name) => name.trim())

  // The position of each column we need, under whichever of its names the file
  // used. A column absent under all of them stays out of the map, and the check
  // below refuses the file.
  const index = new Map(
    Object.entries(COLUMNS).map(([role, names]) => [
      role,
      header.findIndex((name) => (names as readonly string[]).includes(name)),
    ])
  )

  if ([...index.values()].some((position) => position === -1)) {
    throw new UnrecognisedFileError(
      Object.values(COLUMNS).map((names) => names[0]),
      header
    )
  }

  const at = (row: string[], role: keyof typeof COLUMNS) =>
    (row[index.get(role) ?? -1] ?? "").trim()

  const movements: ParsedMovement[] = []
  let unreadable = 0
  const data = rows.slice(1)

  for (const row of data) {
    // Anything else may still be reverted, and a reverted payment that was
    // imported is money the summary says was spent and never was.
    if (!SETTLED.includes(at(row, "state").toUpperCase())) continue

    const date = dateToUtcMidnight(at(row, "date"))
    const amountCents = amountToCents(at(row, "amount"))
    const description = at(row, "description")

    if (date === null || amountCents === null || description === "") {
      unreadable++
      continue
    }

    movements.push({
      date,
      amountCents,
      providerCategory: at(row, "kind") || null,
      providerRef: null,
      description,
    })

    // A fee is a real outgoing. Folding it into the amount beside it would make
    // the payment look bigger than it was and the fee disappear as a line.
    const feeCents = amountToCents(at(row, "fee"))
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
