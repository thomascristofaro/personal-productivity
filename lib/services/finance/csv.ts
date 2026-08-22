// The three readers share this. A statement is a small file written by a bank,
// not arbitrary user input, but "small file written by a bank" still includes a
// description with a comma in it, a semicolon-separated Italian export, and a
// byte order mark — each of which silently corrupts a naive split.

const DELIMITERS = [";", ",", "\t"] as const

// How many lines to look at when deciding the delimiter. The first line is not
// enough: the Intesa export opens with a title and an account number, neither
// of which holds a separator, and choosing from those gives every row one
// column and hides the header from the reader entirely.
const SNIFF_LINES = 10

// The delimiter that appears most often on any of the first few lines. Real
// files are not ambiguous about this; guessing wrongly produces one column,
// which the readers then refuse by name rather than importing nonsense.
function delimiterOf(text: string): string {
  const lines = text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .slice(0, SNIFF_LINES)

  let best = ","
  let bestCount = 0

  for (const candidate of DELIMITERS) {
    const count = lines.reduce(
      (most, line) => Math.max(most, line.split(candidate).length - 1),
      0
    )
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }

  return best
}

/**
 * Splits a CSV file into rows of fields.
 *
 * @param text - the whole file
 * @returns one array per row; an empty array for an empty file
 */
export function splitCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n/g, "\n")
  if (clean.trim() === "") return []

  const delimiter = delimiterOf(clean)
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]

    if (quoted) {
      if (char === '"') {
        // A doubled quote is one quote; a single one closes the field.
        if (clean[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ""
    } else if (char === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else {
      field += char
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // A file ending in a newline leaves a row of one empty field, and so does a
  // blank line between records. Neither is data.
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""))
}
