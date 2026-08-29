import {
  type ParsedMovement,
  type ReadResult,
  type StatementFile,
} from "@/lib/services/finance/parsers/types"
import { cellToUtcMidnight, numberToCents } from "@/lib/services/finance/values"
import { isBlank, tableOf, text } from "@/lib/services/finance/xlsx"

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
  // The transactions are found by their columns and not by a sheet's name or
  // position: the workbook also holds a legend, and either of those would be
  // the thing that breaks when Satispay adds a third sheet.
  const table = await tableOf(file, REQUIRED)

  const movements: ParsedMovement[] = []
  let unreadable = 0
  let rowsRead = 0

  for (const row of table.rows) {
    if (isBlank(row)) continue
    rowsRead++

    const state = text(table.at(row, STATE))
    if (state !== "" && !SETTLED.test(state)) continue

    const date = cellToUtcMidnight(table.at(row, "Data"))
    const amountCents = numberToCents(table.at(row, "Importo"))
    const name = text(table.at(row, "Nome"))

    if (date === null || amountCents === null || name === "") {
      unreadable++
      continue
    }

    const providerRef = text(table.at(row, ID)) || null

    movements.push({
      date,
      amountCents,
      description: name,
      providerCategory: text(table.at(row, KIND)) || null,
      // The only one of the three that carries an id. It makes a movement
      // unique on its own, so the occurrence counting of fingerprint.ts never
      // has to engage.
      providerRef,
    })

    // What the euro balance actually did, when the file says. The difference is
    // what some voucher paid, and it is taken as a difference rather than by
    // adding up the voucher columns so that the two rows sum to the balance
    // movement even if a column we do not know about appears.
    const availabilityCents = numberToCents(table.at(row, AVAILABILITY))
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

  return { movements, rowsRead, unreadable }
}
