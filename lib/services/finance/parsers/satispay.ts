import readXlsxFile from "read-excel-file/node"

import {
  type ParsedMovement,
  type ReadResult,
  type StatementFile,
  UnrecognisedFileError,
} from "@/lib/services/finance/parsers/types"
import { cellToUtcMidnight, numberToCents } from "@/lib/services/finance/values"

// Satispay exports a real workbook, not a CSV, and its transactions sit in one
// sheet beside a legend. Verified against an export of August 2026.
const REQUIRED = ["Data", "Nome", "Importo"] as const

const KIND = "Tipo"
const STATE = "Stato"
const AVAILABILITY = "Disponibilità"
const ID = "ID"

// Every value in the column carries an emoji, and the legend sheet lists three:
// approved, in progress, cancelled. Only the first moved money.
const SETTLED = /approvat/i

// What a compensating row declares as its own category, so one rule maps all of
// them to a TRANSFER category rather than one rule per kind of voucher.
export const VOUCHER_CATEGORY = "Buono"

/**
 * Reads a Satispay movements export.
 *
 * A payment part-covered by meal vouchers is two rows, not one: the payment for
 * what it cost, and the voucher for what it covered. Their sum is the movement
 * of the euro balance, so the balance still agrees with the app while the
 * expense stays the real one — design document section 8.1.
 *
 * @param file - the whole .xlsx file, as bytes
 * @returns the movements it holds, with what was read and what could not be
 * @throws UnrecognisedFileError when the file is not a Satispay workbook
 */
export async function readSatispay(file: StatementFile): Promise<ReadResult> {
  const sheets = await sheetsOf(file)

  // The transactions sheet is found by its columns and not by its name or its
  // position: the workbook also holds a legend, and either of those would be
  // the thing that breaks when Satispay adds a third sheet.
  const found = sheets
    .map((sheet) => ({ sheet, header: headerOf(sheet.data) }))
    .find(({ header }) => REQUIRED.every((name) => header.has(name)))

  if (found === undefined) {
    throw new UnrecognisedFileError(REQUIRED, [
      ...headerOf(sheets[0]?.data ?? []).keys(),
    ])
  }

  const { sheet, header } = found
  const at = (row: Row, name: string) => row[header.get(name) ?? -1] ?? null

  const movements: ParsedMovement[] = []
  let unreadable = 0
  const data = sheet.data.slice(1)

  for (const row of data) {
    const state = text(at(row, STATE))
    if (state !== "" && !SETTLED.test(state)) continue

    const date = cellToUtcMidnight(at(row, "Data"))
    const amountCents = numberToCents(at(row, "Importo"))
    const name = text(at(row, "Nome"))

    if (date === null || amountCents === null || name === "") {
      unreadable++
      continue
    }

    const providerRef = text(at(row, ID)) || null

    movements.push({
      date,
      amountCents,
      description: name,
      providerCategory: text(at(row, KIND)) || null,
      // The only one of the three that carries an id. It makes a movement
      // unique on its own, so the occurrence counting of fingerprint.ts never
      // has to engage.
      providerRef,
    })

    // What the euro balance actually did, when the file says. The difference is
    // what some voucher paid, and it is taken as a difference rather than by
    // adding up the voucher columns so that the two rows sum to the balance
    // movement even if a column we do not know about appears.
    const availabilityCents = numberToCents(at(row, AVAILABILITY))
    if (availabilityCents === null || availabilityCents === amountCents) {
      continue
    }

    movements.push({
      date,
      amountCents: availabilityCents - amountCents,
      // Deliberately not «Buono pasto — Mercatò Local». A DESCRIPTION_CONTAINS
      // rule for the shop runs before the provider map does and would file this
      // credit under the shop's own category, where it would cancel part of the
      // expense it exists to complete.
      description: "Buono pasto o acquisto",
      providerCategory: VOUCHER_CATEGORY,
      providerRef: providerRef === null ? null : `${providerRef}:voucher`,
    })
  }

  return { movements, rowsRead: data.length, unreadable }
}

type Cell = string | number | boolean | Date | null
type Row = Cell[]
type Sheet = { sheet: string; data: Row[] }

async function sheetsOf(file: StatementFile): Promise<Sheet[]> {
  try {
    // A Buffer and not the Uint8Array we were handed: the library passes the
    // argument to fs when it is not one, and a Uint8Array is read as a path.
    return (await readXlsxFile(Buffer.from(file))) as unknown as Sheet[]
  } catch {
    // Anything the library refuses to open is a file that is not this export —
    // a CSV, an empty upload, the wrong statement — and the screen says so the
    // same way it does for a workbook with the wrong columns.
    throw new UnrecognisedFileError(REQUIRED, [])
  }
}

// Satispay writes an instruction inside a column name — the id column is headed
// «ID (Comunicalo all'Assistenza Clienti in caso di problemi)». The note is
// dropped so the reader can ask for the column by its name.
function headerOf(data: Row[]): Map<string, number> {
  return new Map(
    (data[0] ?? []).map((cell, position) => [
      text(cell).replace(/\s*\(.*$/, ""),
      position,
    ])
  )
}

function text(cell: Cell): string {
  return cell === null || cell === undefined ? "" : String(cell).trim()
}
