// Money is held as integer cents everywhere — see section 8 of the design
// document of 2026-08-18. This module is the only place it becomes a string, so
// the app cannot end up with two spellings of the same amount. Parsing lives in
// lib/schemas/shopping.ts instead, because lib/schemas may import Zod and its
// own siblings and nothing else.

const euro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
})

/**
 * Renders an amount in cents as Italian currency.
 *
 * @param cents - the amount, as the database holds it
 * @returns the amount with its symbol, for example "12,34 €"
 */
export function formatEuro(cents: number): string {
  return euro.format(cents / 100)
}
