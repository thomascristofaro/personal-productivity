import type { RuleKind } from "@/lib/schemas/finance"

export type MatchableRule = {
  id: string
  kind: RuleKind
  pattern: string
  categoryId: string
  priority: number
  // Null means every account.
  accountId: string | null
}

export type MatchableMovement = {
  accountId: string
  description: string
  providerCategory: string | null
}

export type Match = {
  categoryId: string
  source: "RULE" | "PROVIDER_MAP"
  ruleId: string
}

const normalise = (value: string) =>
  value.toLowerCase().replace(/\s+/g, " ").trim()

// Description rules run as a class before provider-category rules, whatever
// their priorities say: the owner wrote a description rule looking at a real
// movement, and the provider's own word is a generalisation.
const KIND_ORDER: Record<RuleKind, number> = {
  DESCRIPTION_CONTAINS: 0,
  PROVIDER_CATEGORY_IS: 1,
}

/**
 * The category a movement takes from the rules, if any.
 *
 * @param rules - every rule, in any order
 * @param movement - the movement's account, description and declared category
 * @returns the first match, or null when none applies
 */
export function categorise(
  rules: readonly MatchableRule[],
  movement: MatchableMovement
): Match | null {
  const description = normalise(movement.description)
  const declared =
    movement.providerCategory === null
      ? null
      : normalise(movement.providerCategory)

  const applicable = rules
    .filter(
      (rule) => rule.accountId === null || rule.accountId === movement.accountId
    )
    .sort(
      (a, b) =>
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.priority - b.priority
    )

  for (const rule of applicable) {
    const pattern = normalise(rule.pattern)
    if (pattern === "") continue

    if (rule.kind === "DESCRIPTION_CONTAINS") {
      if (description.includes(pattern)) {
        return { categoryId: rule.categoryId, source: "RULE", ruleId: rule.id }
      }
      continue
    }

    // Whole value, not a substring: a declared category is a value the provider
    // chose from a list, and "Bar" matching "Barber" would be a bug nobody
    // would look for.
    if (declared !== null && declared === pattern) {
      return {
        categoryId: rule.categoryId,
        source: "PROVIDER_MAP",
        ruleId: rule.id,
      }
    }
  }

  return null
}

// The words every statement is full of, which are never the thing you would
// write a rule about.
const NOISE = new Set([
  "pagamento",
  "pagamenti",
  "carta",
  "addebito",
  "accredito",
  "bonifico",
  "sepa",
  "commissione",
  "acquisto",
  "prelievo",
  "ricarica",
  "operazione",
  "payment",
  "from",
  "card",
  "transfer",
  "topup",
])

/**
 * The word a rule about this movement would most likely be written around.
 *
 * A suggestion the owner edits, never a decision: it is prefilled into the
 * rule's field on the movement screen.
 *
 * @param description - the movement's description, as the file wrote it
 * @returns the suggested pattern, uppercased; the whole description when
 *   nothing stands out
 */
export function suggestPattern(description: string): string {
  const words = description
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 4)

  const candidate = words.find((word) => !NOISE.has(word.toLowerCase()))

  return (candidate ?? description).trim().toUpperCase()
}
