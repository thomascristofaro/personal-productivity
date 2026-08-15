import { normaliseIngredientName } from "@/lib/services/ingredient-name"

export type ParsedIngredient = {
  raw: string
  quantity: number | null
  unit: string | null
  name: string
}

// Every spelling maps to one canonical form, because the shopping list groups
// by (name, unit) and "gr" beside "g" would split one line into two.
const UNIT_ALIASES = new Map([
  ["g", "g"],
  ["gr", "g"],
  ["grammo", "g"],
  ["grammi", "g"],
  ["kg", "kg"],
  ["chilo", "kg"],
  ["chili", "kg"],
  ["chilogrammi", "kg"],
  ["ml", "ml"],
  ["cl", "cl"],
  ["l", "l"],
  ["lt", "l"],
  ["litro", "l"],
  ["litri", "l"],
  ["pz", "pz"],
  ["pezzo", "pz"],
  ["pezzi", "pz"],
  ["spicchio", "spicchio"],
  ["spicchi", "spicchio"],
  ["fetta", "fetta"],
  ["fette", "fetta"],
  ["foglia", "foglia"],
  ["foglie", "foglia"],
  ["cucchiaio", "cucchiaio"],
  ["cucchiai", "cucchiaio"],
  ["cucchiaino", "cucchiaino"],
  ["cucchiaini", "cucchiaino"],
  ["rametto", "rametto"],
  ["rametti", "rametto"],
  ["barattolo", "barattolo"],
  ["barattoli", "barattolo"],
  ["lattina", "lattina"],
  ["lattine", "lattina"],
  ["confezione", "confezione"],
  ["confezioni", "confezione"],
  ["bustina", "bustina"],
  ["bustine", "bustina"],
  ["pizzico", "pizzico"],
  ["pizzichi", "pizzico"],
  ["mazzetto", "mazzetto"],
  ["mazzetti", "mazzetto"],
])

// The final dot sits outside the word boundary, or "q.b." fails to match: after a
// full stop there is no word character for \b to anchor against.
const TO_TASTE = /\s*\b(?:q\.?\s?b|quanto basta)\b\.?\s*/
const LEADING_NUMBER = /^(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?)\s*/
// "un" and friends need a boundary, or "unghie" starts with a quantity of one.
const LEADING_ONE = /^(?:(?:un|uno|una)\s+|un')/

function readQuantity(text: string): { quantity: number | null; rest: string } {
  const numeric = LEADING_NUMBER.exec(text)

  if (numeric !== null) {
    const [fullMatch, literal] = numeric
    const fraction = literal.split("/")
    const quantity =
      fraction.length === 2
        ? Number(fraction[0]) / Number(fraction[1])
        : Number(literal.replace(",", "."))

    return { quantity, rest: text.slice(fullMatch.length) }
  }

  const article = LEADING_ONE.exec(text)

  return article === null
    ? { quantity: null, rest: text }
    : { quantity: 1, rest: text.slice(article[0].length) }
}

function readUnit(text: string): { unit: string | null; rest: string } {
  const [token] = text.split(/\s+/, 1)
  const canonical = UNIT_ALIASES.get(token)

  return canonical === undefined
    ? { unit: null, rest: text }
    : { unit: canonical, rest: text.slice(token.length) }
}

/**
 * Splits an Italian ingredient line into a quantity, a unit and a name.
 *
 * Never throws and never loses anything: an unrecognisable line comes back with
 * a null quantity and unit, and `raw` always holds what was written. The shopping
 * list shows such a line unquantified rather than guessing at it.
 *
 * @param raw One ingredient as written, for example "320 g di spaghetti".
 * @returns The parsed parts, with the unit canonicalised and the name normalised.
 */
export function parseIngredientLine(raw: string): ParsedIngredient {
  const collapsed = raw
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
  const toTaste = TO_TASTE.test(collapsed)
  const withoutToTaste = collapsed.replace(TO_TASTE, " ").trim()

  if (toTaste) {
    return {
      raw,
      quantity: null,
      unit: null,
      name: normaliseIngredientName(withoutToTaste),
    }
  }

  const { quantity, rest: afterQuantity } = readQuantity(withoutToTaste)
  const { unit, rest } =
    quantity === null
      ? { unit: null, rest: afterQuantity }
      : readUnit(afterQuantity.trim())

  return { raw, quantity, unit, name: normaliseIngredientName(rest) }
}
