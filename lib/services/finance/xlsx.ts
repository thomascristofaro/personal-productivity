import readXlsxFile from "read-excel-file/node"

import { UnrecognisedFileError } from "@/lib/services/finance/parsers/types"

// Two of the three exports are workbooks, and both bury their table: Satispay
// beside a legend sheet, Intesa under eighteen rows of account and period. So
// neither reader may assume a sheet or a row, and both look for the columns.

export type Cell = string | number | boolean | Date | null
export type Row = Cell[]

export type Table = {
  /** The rows under the header, in the order the file wrote them. */
  rows: Row[]
  /** A row's cell, by the header's own name for its column. */
  at: (row: Row, name: string) => Cell
}

/**
 * Reads a cell as trimmed text.
 *
 * @param cell - the cell's value, of whatever type the workbook gave it
 * @returns its text, or the empty string when the cell is empty
 */
export function text(cell: Cell): string {
  return cell === null || cell === undefined ? "" : String(cell).trim()
}

/**
 * Finds a statement's table inside a workbook, wherever it sits.
 *
 * @param file - the whole .xlsx file, as bytes
 * @param required - the columns that identify the table
 * @returns the rows under the header, and a way to read them by column name
 * @throws UnrecognisedFileError when no sheet holds a row with those columns,
 *   carrying the likeliest header it did find so the file diagnoses itself
 */
export async function tableOf(
  file: Uint8Array,
  required: readonly string[]
): Promise<Table> {
  const sheets = await sheetsOf(file, required)

  for (const sheet of sheets) {
    for (const [at, row] of sheet.data.entries()) {
      const header = headerOf(row)
      if (!required.every((name) => header.has(name))) continue

      return {
        rows: sheet.data.slice(at + 1),
        at: (cells, name) => cells[header.get(name) ?? -1] ?? null,
      }
    }
  }

  throw new UnrecognisedFileError(required, [
    ...headerOf(widestRow(sheets[0]?.data ?? [])).keys(),
  ])
}

/**
 * Whether a row holds nothing at all.
 *
 * A workbook keeps rows that were only ever formatted, and counting those as
 * statement rows would report an import as partly unreadable every time.
 *
 * @param row - the row's cells
 * @returns true when every cell is empty
 */
export function isBlank(row: Row): boolean {
  return row.every((cell) => text(cell) === "")
}

type Sheet = { sheet: string; data: Row[] }

async function sheetsOf(
  file: Uint8Array,
  required: readonly string[]
): Promise<Sheet[]> {
  try {
    // A Buffer and not the Uint8Array we were handed: the library passes the
    // argument to fs when it is not one, and a Uint8Array is read as a path.
    return (await readXlsxFile(Buffer.from(file))) as unknown as Sheet[]
  } catch {
    // Anything the library refuses to open is a file that is not this export —
    // a CSV, an empty upload, the wrong statement — and the screen says so the
    // same way it does for a workbook with the wrong columns.
    throw new UnrecognisedFileError(required, [])
  }
}

// Satispay writes an instruction inside a column name — the id column is headed
// «ID (Comunicalo all'Assistenza Clienti in caso di problemi)» — and Intesa
// leaves a trailing space in «Categoria ». Both are dropped so a reader can ask
// for a column by the name a person would read off the screen.
function headerOf(row: Row): Map<string, number> {
  return new Map(
    row.map((cell, position) => [text(cell).replace(/\s*\(.*$/, ""), position])
  )
}

// What to print beside the columns we wanted, when none of the sheets matched.
// The first row is not it: the sheet that opens with eighteen rows of preamble
// would report nothing at all, which is the one case this message exists for.
function widestRow(data: Row[]): Row {
  let best: Row = []
  let bestFilled = 0

  for (const row of data) {
    const filled = row.filter((cell) => text(cell) !== "").length
    if (filled > bestFilled) {
      best = row
      bestFilled = filled
    }
  }

  return best
}
