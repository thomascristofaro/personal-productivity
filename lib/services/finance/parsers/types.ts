export type ParsedMovement = {
  // Midnight UTC, the @db.Date convention.
  date: Date
  // Integer cents, negative for an outgoing.
  amountCents: number
  description: string
  // What the file declared as its own category, verbatim. Null when it declares
  // none. Never interpreted here — that is the next plan's work.
  providerCategory: string | null
  // The provider's own transaction id, when the file carries one.
  providerRef: string | null
}

/**
 * An uploaded statement, as bytes.
 *
 * Bytes and not text: Satispay exports a binary workbook, and a reader that
 * took a string would have to be handed something already decoded, which for
 * that one file destroys it. The CSV readers decode it themselves.
 */
export type StatementFile = Uint8Array

/**
 * A reader for one provider's export.
 *
 * Asynchronous for all three though only one needs to be: a signature that
 * changes with the provider would push the difference into every caller.
 */
export type StatementReader = (file: StatementFile) => Promise<ReadResult>

export type ReadResult = {
  movements: ParsedMovement[]
  // Data rows the file held, excluding the header and any preamble.
  rowsRead: number
  // Rows that had the right shape but an amount or a date that could not be
  // read. Counted and reported; never silently dropped.
  unreadable: number
}

/**
 * Thrown when a file does not look like an export from the chosen provider.
 *
 * Carries both column lists so the screen can print them: the first real export
 * of a provider whose layout was guessed diagnoses itself this way.
 */
export class UnrecognisedFileError extends Error {
  constructor(
    readonly expected: readonly string[],
    readonly found: readonly string[]
  ) {
    super("The file's columns do not match the reader's.")
    this.name = "UnrecognisedFileError"
  }
}
