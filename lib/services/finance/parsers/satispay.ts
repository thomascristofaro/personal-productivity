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
const REQUIRED = ["Data", "Nome", "Importo"] as const
const ID = "ID"
const KIND = "Tipo"
const STATE = "Stato"

const SETTLED = /accett|success|complet|esegui/i

/**
 * Reads a Satispay movements export.
 *
 * @param text - the whole CSV file
 * @returns the movements it holds, with what was read and what could not be
 * @throws UnrecognisedFileError when the header is not Satispay's
 */
export function readSatispay(text: string): ReadResult {
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
    // A refused or cancelled payment never moved money. The column is treated
    // as optional because it may not exist in the real export; when it does
    // not, every row counts, which is the safe direction.
    const state = at(row, STATE)
    if (state !== "" && !SETTLED.test(state)) continue

    const date = dateToUtcMidnight(at(row, "Data"))
    const amountCents = amountToCents(at(row, "Importo"))
    const name = at(row, "Nome")

    if (date === null || amountCents === null || name === "") {
      unreadable++
      continue
    }

    movements.push({
      date,
      amountCents,
      description: name,
      providerCategory: at(row, KIND) || null,
      // The only one of the three expected to carry an id. When it does, it
      // makes a movement unique on its own and the occurrence counting of
      // fingerprint.ts never has to engage.
      providerRef: at(row, ID) || null,
    })
  }

  return { movements, rowsRead: data.length, unreadable }
}
