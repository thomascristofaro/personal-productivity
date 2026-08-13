import { parseIngredientLine } from "@/lib/services/ingredient-parse"

export type IngredientRow = {
  raw: string
  name: string
  quantity: number | null
  unit: string | null
  position: number
}

/**
 * Turns a block of typed ingredient lines into rows ready to persist.
 *
 * Blank lines are dropped and the remaining rows renumbered, so `position`
 * always runs from zero without gaps. Each row keeps the line exactly as it was
 * written: a line the parser cannot read is stored unquantified rather than
 * rejected, and the user can correct it later from what they actually typed.
 *
 * @param block The ingredients as typed, one per line.
 * @returns One row per non-blank line, in the order they appeared.
 */
export function ingredientRowsFrom(block: string): IngredientRow[] {
  return block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, position) => {
      const { raw, name, quantity, unit } = parseIngredientLine(line)
      return { raw, name, quantity, unit, position }
    })
}
