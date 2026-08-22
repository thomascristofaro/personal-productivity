import { splitCsv } from "@/lib/services/finance/csv"
import {
  type ParsedMovement,
  type ReadResult,
  UnrecognisedFileError,
} from "@/lib/services/finance/parsers/types"
import { amountToCents, dateToUtcMidnight } from "@/lib/services/finance/values"

// UNVERIFIED against a real export — see the plan of 2026-08-23, "the state of
// the three formats". Correcting this reader is editing these lists and the
// fixture in the test.
const REQUIRED = ["Data", "Operazione", "Importo"] as const
const DETAILS = "Dettagli"
const CATEGORY = "Categoria"

/**
 * Reads an Intesa Sanpaolo statement export.
 *
 * The export opens with a preamble of title and account rows, so the header is
 * looked for rather than assumed to be first.
 *
 * @param text - the whole CSV file
 * @returns the movements it holds, with what was read and what could not be
 * @throws UnrecognisedFileError when no row in the file is Intesa's header
 */
export function readIntesa(text: string): ReadResult {
  const rows = splitCsv(text)

  const headerAt = rows.findIndex((row) => {
    const names = row.map((name) => name.trim())
    return REQUIRED.every((name) => names.includes(name))
  })

  if (headerAt === -1) {
    throw new UnrecognisedFileError(REQUIRED, rows[0] ?? [])
  }

  const header = rows[headerAt] ?? []
  const index = new Map(header.map((name, position) => [name.trim(), position]))
  const at = (row: string[], name: string) =>
    (row[index.get(name) ?? -1] ?? "").trim()

  const movements: ParsedMovement[] = []
  let unreadable = 0
  const data = rows.slice(headerAt + 1)

  for (const row of data) {
    const date = dateToUtcMidnight(at(row, "Data"))
    const amountCents = amountToCents(at(row, "Importo"))
    const operation = at(row, "Operazione")
    const details = at(row, DETAILS)

    if (date === null || amountCents === null || operation === "") {
      unreadable++
      continue
    }

    movements.push({
      date,
      amountCents,
      // Both, because on its own the operation says "Pagamento POS" for
      // everything and the details say a shop with no verb.
      description: details === "" ? operation : `${operation} — ${details}`,
      providerCategory: at(row, CATEGORY) || null,
      providerRef: null,
    })
  }

  return { movements, rowsRead: data.length, unreadable }
}
