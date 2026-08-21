/**
 * A recipe as the proposal sees it. Deliberately not the Prisma model: the
 * instructions are most of a recipe's tokens and play no part in deciding
 * whether to schedule it on Tuesday, so they are not representable here.
 */
export type CandidateRecipe = {
  id: string
  title: string
  totalMinutes: number | null
  tags: string[]
  ingredients: string[]
  lastCookedDaysAgo: number | null
}

export type CandidateIndex = {
  byNumber: Map<number, string>
  count: number
}

function describeRecipe(recipe: CandidateRecipe, position: number): string {
  const parts = [`${position}. ${recipe.title}`]

  if (recipe.totalMinutes !== null) parts.push(`${recipe.totalMinutes}min`)
  if (recipe.tags.length > 0) parts.push(recipe.tags.join(", "))
  if (recipe.ingredients.length > 0) parts.push(recipe.ingredients.join(", "))
  if (recipe.lastCookedDaysAgo !== null) {
    parts.push(`ultima volta ${recipe.lastCookedDaysAgo} giorni fa`)
  }

  return parts.join(" — ")
}

/**
 * Renders the candidates as the numbered block the prompt carries.
 *
 * The numbering is one-based and must stay in step with `indexCandidates`,
 * which reads the same array in the same order — that pairing is what makes an
 * integer answer safe to map back to a recipe.
 *
 * @param recipes The candidates, in the order they will be numbered.
 * @returns One line per recipe, newline separated.
 */
export function buildCandidateLines(recipes: CandidateRecipe[]): string {
  return recipes.map((recipe, i) => describeRecipe(recipe, i + 1)).join("\n")
}

/**
 * Builds the lookup from the numbers in the prompt back to recipe ids.
 *
 * @param recipes The same array, in the same order, as `buildCandidateLines`.
 * @returns The number-to-id map and how many candidates there are.
 */
export function indexCandidates(recipes: CandidateRecipe[]): CandidateIndex {
  return {
    byNumber: new Map(recipes.map((recipe, i) => [i + 1, recipe.id])),
    count: recipes.length,
  }
}
