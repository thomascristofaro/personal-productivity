// Word-final particles must be followed by whitespace, or "lardo" normalises to
// "rdo". The elided forms carry their own boundary in the apostrophe.
const LEADING_PARTICLE =
  /^(?:(?:di|del|dello|della|dei|degli|delle|il|lo|la|i|gli|le)\s+|[dl]'|dell'|degl')/

// Scraped and LLM-produced text spells the elision with a typographic
// apostrophe (U+2019, U+2018, U+02BC), not the ASCII one. Folding it early,
// everywhere in the string, keeps "d'aglio" and "d’aglio" one key instead
// of two.
const APOSTROPHE_FOLD = /[‘’ʼ]/g

/**
 * Reduces an ingredient name to the form used as a key.
 *
 * Deliberately shallow: no stemming, no singularisation, no synonyms, so
 * "pomodori pelati" and "pelati" stay two different things until that becomes a
 * nuisance.
 *
 * Nothing calls this today, and that is deliberate. Since the ingredient
 * catalogue landed, a recipe line points at a curated `Ingredient` and no name
 * is ever normalised on the way in. This function is for the URL import of
 * design document §6.1, where a string arrives from outside and has to be
 * matched against the catalogue — the one place an heuristic still belongs. It
 * no longer produces a stored key, so changing it orphans nothing.
 *
 * @param raw The name as written, from a recipe source or typed by hand.
 * @returns The normalised name, which is stable under a second application.
 */
export function normaliseIngredientName(raw: string): string {
  return raw
    .normalize("NFC")
    .toLowerCase()
    .replace(APOSTROPHE_FOLD, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(LEADING_PARTICLE, "")
    .trim()
}
