import {
  type ParsedMovement,
  type ReadResult,
  type StatementFile,
} from "@/lib/services/finance/parsers/types"
import { cellToUtcMidnight, numberToCents } from "@/lib/services/finance/values"
import { isBlank, tableOf, text } from "@/lib/services/finance/xlsx"

// Verified against a real export of August 2026. The «Lista Operazioni» comes
// out of the app as an .xlsx workbook and not as a CSV, which is what the first
// version of this reader was written against and why it read nothing at all.
const REQUIRED = ["Data", "Operazione", "Importo"] as const

const BOOKED = "Contabilizzazione"
const CATEGORY = "Categoria"

// `Contabilizzazione` is a yes-or-no and not a second date: it says whether the
// movement has reached the account yet. A row that has not is provisional, its
// date can still move, and importing it would land the same payment twice under
// two dates — the fingerprint is built from one. Skipped, not counted as
// unreadable.
//
// Matched on the no rather than on the yes so that a value we have not seen is
// imported. A wording change would then show a movement to look at, where the
// other way round it would show an import of nothing and say why nowhere.
const NOT_BOOKED = /^no$/i

/**
 * Reads an Intesa Sanpaolo «Lista Operazioni» export.
 *
 * The export carries one date, `Data`, and it is the day the movement was made:
 * the same day is repeated inside `Dettagli` as «EFFETTUATO IL …».
 *
 * @param file - the whole .xlsx file, as bytes
 * @returns the movements it holds, with what was read and what could not be
 * @throws UnrecognisedFileError when the file is not an Intesa workbook
 */
export async function readIntesa(file: StatementFile): Promise<ReadResult> {
  const table = await tableOf(file, REQUIRED)

  const movements: ParsedMovement[] = []
  let unreadable = 0
  let rowsRead = 0

  for (const row of table.rows) {
    if (isBlank(row)) continue
    rowsRead++

    if (NOT_BOOKED.test(text(table.at(row, BOOKED)))) continue

    const date = cellToUtcMidnight(table.at(row, "Data"))
    const amountCents = numberToCents(table.at(row, "Importo"))
    const operation = text(table.at(row, "Operazione"))

    if (date === null || amountCents === null || operation === "") {
      unreadable++
      continue
    }

    movements.push({
      date,
      amountCents,
      // `Operazione` alone. In the real export it already carries the
      // counterparty — «Revolut**6069* Dublin», «Bonifico disposto da …» —
      // while `Dettagli` is a hundred characters of card number and internal
      // reference around the same name. Joining them, as this reader did while
      // it was a guess, would make every row unreadable on a phone and every
      // description rule harder to write.
      description: operation,
      providerCategory: text(table.at(row, CATEGORY)) || null,
      providerRef: null,
    })
  }

  return { movements, rowsRead, unreadable }
}
