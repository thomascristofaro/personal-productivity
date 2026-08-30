// Every search in the app matches this way: the query is a set of words, and a
// result has to contain all of them, anywhere and in any order. The rule it
// replaces treated the query as one string, so «insalata zucchine» could never
// find «Insalata con zucchine» — which is what a search is for.

// A bound on the query, not a feature: every token becomes an AND clause in the
// database, and a paragraph pasted by accident must not become fifty of them.
const MAX_TOKENS = 8

const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "")

/**
 * Splits a query into the words a result has to contain.
 *
 * Lower-cased but with the accents left on, because these tokens are handed to
 * Postgres: `mode: "insensitive"` is ILIKE, which folds case and not accents,
 * so dropping the accent here would stop «ragù» finding «Ragù».
 *
 * @param query What the user typed.
 * @returns The words, at most eight; empty for a blank query, which filters nothing.
 */
export function searchTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token !== "")
    .slice(0, MAX_TOKENS)
}

/**
 * Whether every word of the query appears somewhere in the text.
 *
 * Ignores case and accents. That is what Base UI's own combobox filter does, at
 * collator sensitivity "base", and this replaces it rather than sitting beside
 * it — so it must not be stricter than what it takes over from.
 *
 * @param text The candidate.
 * @param query What the user typed.
 * @returns True when every word is present, and for a blank query.
 */
export function matchesQuery(text: string, query: string): boolean {
  const haystack = fold(text.toLowerCase())

  return searchTokens(query).every((token) => haystack.includes(fold(token)))
}

/**
 * Lifts the rows the query answers directly above the ones it reaches sideways.
 *
 * A recipe search reads the ingredients as well as the title, so «zucchine»
 * finds everything that uses them — and «Zucchine ripiene» is what was meant.
 * Sorting is stable, so rows of equal rank keep the order they arrived in, and
 * the caller's own ordering survives underneath this one.
 *
 * Belongs here rather than in a query because it is applied to a whole list; a
 * paginated result could not be reordered after the fact.
 *
 * @param items The matches, in the order the caller wants them otherwise.
 * @param query What the user typed.
 * @param textOf The field the query is judged against.
 * @returns A new array, direct matches first.
 */
export function matchesFirst<T>(
  items: readonly T[],
  query: string,
  textOf: (item: T) => string
): T[] {
  return [...items].sort(
    (a, b) =>
      Number(matchesQuery(textOf(b), query)) -
      Number(matchesQuery(textOf(a), query))
  )
}
