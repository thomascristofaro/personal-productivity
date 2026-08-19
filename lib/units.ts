// Units are free text the two users type, so this cannot be a lookup table of
// known words. It is the regular Italian plural, applied to whatever it is
// given: -o becomes -i, -a becomes -e, -e becomes -i, and anything ending in a
// consonant is left alone — which is exactly what keeps the symbols (g, ml, kg,
// l) invariant without having to enumerate them.

// A hard c or g stays hard in the plural, so the spelling grows an h to keep it:
// "sacco" is "sacchi", never "sacci". The -cia/-gia pairs go the other way and
// lose the i: "goccia" is "gocce".
const PLURAL_RULES: [RegExp, string][] = [
  [/io$/, "i"],
  [/([cg])o$/, "$1hi"],
  [/([cg])a$/, "$1he"],
  // Only after a consonant. After a vowel the i is stressed and survives —
  // "camicia" is "camicie" — but no unit of measure is shaped that way.
  [/([^aeiou])cia$/, "$1ce"],
  [/([^aeiou])gia$/, "$1ge"],
  [/o$/, "i"],
  [/a$/, "e"],
  [/e$/, "i"],
]

// A null unit alongside a quantity means a count of whole things — "2 uova".
const COUNTABLE_UNITS = new Set([
  "pz",
  "spicchio",
  "fetta",
  "foglia",
  "rametto",
  "barattolo",
  "lattina",
  "confezione",
  "bustina",
  "mazzetto",
])

/**
 * Whether the unit counts whole things rather than measuring them.
 *
 * The aggregator rounds these up — half an egg missing is found at the stove —
 * and the shopping row offers plus and minus buttons for them, which would be
 * useless on a line measured in grams.
 *
 * @param unit - the unit, or null when the thing is counted in pieces
 * @returns true when the thing is counted
 */
export function isCountable(unit: string | null): boolean {
  return unit === null || unit === "" || COUNTABLE_UNITS.has(unit)
}

/**
 * Agrees an Italian unit with the quantity in front of it.
 *
 * @param unit - the unit as the catalogue holds it, always singular
 * @param quantity - the quantity it will be rendered beside
 * @returns the unit, pluralised when the quantity is not exactly one
 */
export function unitFor(unit: string, quantity: number): string {
  if (quantity === 1) return unit

  for (const [pattern, replacement] of PLURAL_RULES) {
    if (pattern.test(unit)) return unit.replace(pattern, replacement)
  }

  return unit
}

/**
 * Renders a quantity and its unit as one string, agreed in number.
 *
 * @param quantity - the quantity, or null for an unquantified line
 * @param unit - the unit, or null when the thing is counted in pieces
 * @returns the rendered amount, or null when there is no quantity to show
 */
export function amountOf(
  quantity: number | null,
  unit: string | null
): string | null {
  if (quantity === null) return null
  if (unit === null || unit === "") return `${quantity}`
  return `${quantity} ${unitFor(unit, quantity)}`
}

/**
 * Renders a shopping line whose shopper decided how much of it to take.
 *
 * Two numbers where the list normally shows one, so the form says which is
 * which: "1 di 2 burratine" is one going in the trolley and two the menu wants.
 * More than the menu asked for reads the same way round — "3 di 2 burratine" —
 * because the first number is always what is being bought.
 *
 * @param taken - what is going in the trolley, or null for all of it
 * @param quantity - what the line asks for, or null when it is unquantified
 * @param unit - the unit, or null when the thing is counted in pieces
 * @returns the rendered amount, or null when there is no number to show
 */
export function takenAmountOf(
  taken: number | null,
  quantity: number | null,
  unit: string | null
): string | null {
  if (taken === null) return amountOf(quantity, unit)
  if (quantity === null || taken === quantity) return amountOf(taken, unit)
  return `${taken} di ${amountOf(quantity, unit)}`
}
