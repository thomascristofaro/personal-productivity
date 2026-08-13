// Word-final particles must be followed by whitespace, or "lardo" normalises to
// "rdo". The elided forms carry their own boundary in the apostrophe.
const LEADING_PARTICLE =
  /^(?:(?:di|del|dello|della|dei|degli|delle|il|lo|la|i|gli|le)\s+|[dl]')/

/**
 * Reduces an ingredient name to the form used as a key.
 *
 * Deliberately shallow: no stemming, no singularisation, no synonyms, so
 * "pomodori pelati" and "pelati" stay two lines until that becomes a nuisance.
 * The result is stored as `IngredientAisle.name` and as `RecipeIngredient.name`,
 * so changing this function orphans learned aisles and needs a migration that
 * remaps them.
 *
 * @param raw The name as written, from a recipe source or typed by hand.
 * @returns The normalised name, which is stable under a second application.
 */
export function normaliseIngredientName(raw: string): string {
  return raw
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(LEADING_PARTICLE, "")
    .trim()
}
