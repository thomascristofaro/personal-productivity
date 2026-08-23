import type { FinanceProvider } from "@/lib/schemas/finance"
import { readIntesa } from "@/lib/services/finance/parsers/intesa"
import { readRevolut } from "@/lib/services/finance/parsers/revolut"
import { readSatispay } from "@/lib/services/finance/parsers/satispay"
import type { ReadResult } from "@/lib/services/finance/parsers/types"

// A record and not a switch: adding a provider to the enum without a reader
// then fails to compile, rather than falling through at run time on the one
// upload nobody tested.
const READERS: Record<FinanceProvider, (text: string) => ReadResult> = {
  REVOLUT: readRevolut,
  INTESA: readIntesa,
  SATISPAY: readSatispay,
}

/**
 * The reader that knows a provider's export format.
 *
 * @param provider - the account's provider
 * @returns a function taking the file's text and returning what it holds
 */
export function readerFor(
  provider: FinanceProvider
): (text: string) => ReadResult {
  return READERS[provider]
}
