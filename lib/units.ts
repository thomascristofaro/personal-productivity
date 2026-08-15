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
