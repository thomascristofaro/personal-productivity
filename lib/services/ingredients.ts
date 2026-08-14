import { db } from "@/lib/db"

/** Thrown by `createIngredient` when the name is already in the catalogue. */
export class IngredientExistsError extends Error {
  constructor(name: string) {
    super(`An ingredient named ${name} already exists.`)
    this.name = "IngredientExistsError"
  }
}

export type IngredientOption = {
  name: string
  defaultUnit: string | null
}

// Prisma's unique-constraint failure (P2002), read structurally so this module
// never imports a Prisma type outside lib/db.ts.
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
}

/**
 * Orders units by how often recipes use them, most used first.
 *
 * Exported for its own test: the ranking is the only logic in this module that
 * is worth asserting without a database.
 *
 * @param rows One entry per distinct unit, with the number of rows using it.
 * @returns The unit names, most used first, ties broken alphabetically.
 */
export function rankUnitsByUse(
  rows: { unit: string | null; uses: number }[]
): string[] {
  return rows
    .filter((row): row is { unit: string; uses: number } => {
      return typeof row.unit === "string" && row.unit.trim().length > 0
    })
    .sort((a, b) => b.uses - a.uses || a.unit.localeCompare(b.unit, "it"))
    .map((row) => row.unit)
}

/**
 * Lists the whole catalogue, alphabetically.
 *
 * The catalogue is small — hundreds of rows at most — so it is loaded whole and
 * filtered in the browser rather than queried per keystroke.
 *
 * @returns Every ingredient, ordered by name.
 */
export async function listIngredients(): Promise<IngredientOption[]> {
  return db.ingredient.findMany({
    select: { name: true, defaultUnit: true },
    orderBy: { name: "asc" },
  })
}

/**
 * Finds one catalogue entry by its exact name.
 *
 * Matching is exact, not normalised: the name is a primary key, and the caller
 * either picked it from the catalogue or just created it.
 *
 * @param name The exact ingredient name.
 * @returns The entry, or null when the catalogue has no such name.
 */
export async function findIngredientByName(
  name: string
): Promise<IngredientOption | null> {
  return db.ingredient.findUnique({
    where: { name },
    select: { name: true, defaultUnit: true },
  })
}

/**
 * Lists the units recipes actually use, most used first.
 *
 * Feeds the suggestions on the unit field, so the common three sit at the top
 * and a one-off unit stays possible.
 *
 * @returns The distinct non-empty units, most used first.
 */
export async function listUsedUnits(): Promise<string[]> {
  const rows = await db.recipeIngredient.groupBy({
    by: ["unit"],
    _count: { unit: true },
  })

  return rankUnitsByUse(
    rows.map((row) => ({ unit: row.unit, uses: row._count.unit }))
  )
}

/**
 * Adds an ingredient to the catalogue from the recipe form.
 *
 * Created without a unit or an aisle: the aisle defaults to the catch-all and
 * is corrected later, because interrupting a recipe to classify a supermarket
 * aisle is how a form gets abandoned.
 *
 * @param name The ingredient name, already trimmed and validated by the caller.
 * @returns The new catalogue entry.
 * @throws IngredientExistsError When the name is already in the catalogue.
 */
export async function createIngredient(
  name: string
): Promise<IngredientOption> {
  try {
    return await db.ingredient.create({
      data: { name },
      select: { name: true, defaultUnit: true },
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw new IngredientExistsError(name)
    throw error
  }
}
