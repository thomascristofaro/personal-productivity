import { db } from "@/lib/db"
import type { RecipeInput } from "@/lib/schemas/recipe"

/**
 * Thrown by `updateRecipe` and `deleteRecipe` when the target id no longer
 * exists — typically because another session deleted it first.
 */
export class RecipeNotFoundError extends Error {
  constructor() {
    super("No recipe with this id.")
    this.name = "RecipeNotFoundError"
  }
}

// Prisma failure codes, read structurally so this module never imports a Prisma
// type outside lib/db.ts. P2025 is "record to update/delete not found".
function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  )
}

const isRecordNotFoundError = (error: unknown) => hasPrismaCode(error, "P2025")

// Creates whatever the recipe names and the catalogue lacks, so a save is never
// refused over a name the user has already decided to use — an imported recipe
// brings six new names out of nine. `altro` and no unit is what every new entry
// starts as; /catalog is where it gets corrected, and the recipe form marks the
// new ones before the save so a site's own typo can be caught first.
//
// createMany with skipDuplicates rather than read-then-write: two saves landing
// together must not race each other into a unique violation.
async function ensureIngredients(input: RecipeInput): Promise<void> {
  const names = [...new Set(input.ingredients.map((row) => row.ingredientName))]
  if (names.length === 0) return

  await db.catalogItem.createMany({
    data: names.map((name) => ({ name, kind: "INGREDIENT" as const })),
    skipDuplicates: true,
  })
}

export type RecipeSummary = {
  id: string
  title: string
  servings: number | null
  totalMinutes: number | null
  tags: string[]
}

export type RecipeDetail = RecipeSummary & {
  sourceUrl: string | null
  instructions: string | null
  notes: string | null
  ingredients: {
    id: string
    ingredientName: string
    quantity: number | null
    unit: string | null
  }[]
}

const summaryFields = {
  id: true,
  title: true,
  servings: true,
  totalMinutes: true,
  tags: true,
} as const

// Empty strings become null so a missing note reads as missing.
function toColumns(input: RecipeInput) {
  return {
    title: input.title,
    sourceUrl: input.sourceUrl === "" ? null : input.sourceUrl,
    servings: input.servings ?? null,
    totalMinutes: input.totalMinutes ?? null,
    instructions: input.instructions === "" ? null : input.instructions,
    notes: input.notes === "" ? null : input.notes,
    tags: [...new Set(input.tags.map((tag) => tag.toLowerCase()))],
  }
}

// `position` comes from the array order, so the client never sends it and
// cannot send a duplicate.
function toIngredientRows(input: RecipeInput) {
  return input.ingredients.map((row, position) => ({
    ingredientName: row.ingredientName,
    quantity: row.quantity,
    unit: row.unit,
    position,
  }))
}

/**
 * Lists recipes for the recipe book, newest first.
 *
 * @param query An optional case-insensitive fragment of the title.
 * @returns Every matching recipe, as summaries.
 */
export async function listRecipes(query?: string): Promise<RecipeSummary[]> {
  const trimmed = query?.trim()

  return db.recipe.findMany({
    where: trimmed
      ? { title: { contains: trimmed, mode: "insensitive" } }
      : undefined,
    select: summaryFields,
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Lists every tag any recipe already carries, alphabetically.
 *
 * Feeds the tag suggestions. Tags are a string array on Recipe rather than a
 * table, so this reads them all and flattens — fine at this size, and it keeps
 * a tag from needing a lifecycle of its own.
 *
 * @returns The distinct tags, sorted for Italian.
 */
export async function listTags(): Promise<string[]> {
  const rows = await db.recipe.findMany({ select: { tags: true } })

  return [...new Set(rows.flatMap((row) => row.tags))].sort((a, b) =>
    a.localeCompare(b, "it")
  )
}

/**
 * Reads one recipe with its ingredients in the order they were entered.
 *
 * @param id The recipe's id.
 * @returns The recipe, or null when no recipe has that id.
 */
export async function getRecipe(id: string): Promise<RecipeDetail | null> {
  return db.recipe.findUnique({
    where: { id },
    select: {
      ...summaryFields,
      sourceUrl: true,
      instructions: true,
      notes: true,
      // No join: with a natural key the display name is the foreign key,
      // already on the row.
      ingredients: {
        select: {
          id: true,
          ingredientName: true,
          quantity: true,
          unit: true,
        },
        orderBy: { position: "asc" },
      },
    },
  })
}

/**
 * Creates a recipe and its ingredient rows.
 *
 * @param input The validated recipe as the form supplied it.
 * @returns The id of the recipe that was created.
 */
export async function createRecipe(input: RecipeInput): Promise<string> {
  await ensureIngredients(input)

  const recipe = await db.recipe.create({
    data: {
      ...toColumns(input),
      ingredients: { create: toIngredientRows(input) },
    },
    select: { id: true },
  })

  return recipe.id
}

/**
 * Replaces a recipe and all of its ingredient rows.
 *
 * The ingredients are deleted and recreated rather than reconciled: the form
 * sends a list with no row identity to match against. Both writes share one
 * transaction, so a half-applied edit cannot leave a recipe with no ingredients.
 *
 * @param id The recipe's id.
 * @param input The validated recipe as the form supplied it.
 * @returns Nothing.
 * @throws RecipeNotFoundError when no recipe has that id.
 */
export async function updateRecipe(
  id: string,
  input: RecipeInput
): Promise<void> {
  // Outside the transaction below, so a recipe write that then fails leaves a
  // few unused catalogue entries behind. That is the cheap side of the trade:
  // an unused entry is a row in a screen built for editing them.
  await ensureIngredients(input)

  try {
    await db.$transaction([
      db.recipeIngredient.deleteMany({ where: { recipeId: id } }),
      db.recipe.update({
        where: { id },
        data: {
          ...toColumns(input),
          ingredients: { create: toIngredientRows(input) },
        },
      }),
    ])
  } catch (error) {
    if (isRecordNotFoundError(error)) throw new RecipeNotFoundError()
    throw error
  }
}

/**
 * Deletes a recipe. Its ingredients cascade; menu slots pointing at it are
 * cleared rather than removed, so a past week keeps its shape.
 *
 * @param id The recipe's id.
 * @returns Nothing.
 * @throws RecipeNotFoundError when no recipe has that id.
 */
export async function deleteRecipe(id: string): Promise<void> {
  try {
    await db.recipe.delete({ where: { id } })
  } catch (error) {
    if (isRecordNotFoundError(error)) throw new RecipeNotFoundError()
    throw error
  }
}
