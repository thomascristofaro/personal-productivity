import { db } from "@/lib/db"
import type { RecipeInput } from "@/lib/schemas/recipe"
import { ingredientRowsFrom } from "@/lib/services/recipe-ingredients"

/**
 * Thrown by `updateRecipe` and `deleteRecipe` when the target id no longer
 * exists — typically because another session deleted it first.
 */
export class RecipeNotFoundError extends Error {
  constructor() {
    super("Nessuna ricetta con questo id.")
    this.name = "RecipeNotFoundError"
  }
}

// Prisma's "record to update/delete not found" failure (P2025), read
// structurally so this module never imports a Prisma type outside lib/db.ts.
function isRecordNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2025"
  )
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
    raw: string
    name: string
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

// The form hands over one text field per concept; the database wants columns and
// child rows. Empty strings become null so a missing note reads as missing.
function toColumns(input: RecipeInput) {
  return {
    title: input.title,
    sourceUrl: input.sourceUrl === "" ? null : input.sourceUrl,
    servings: input.servings ?? null,
    totalMinutes: input.totalMinutes ?? null,
    instructions: input.instructions === "" ? null : input.instructions,
    notes: input.notes === "" ? null : input.notes,
    tags: input.tags
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0),
  }
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
      ingredients: {
        select: { id: true, raw: true, name: true, quantity: true, unit: true },
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
  const recipe = await db.recipe.create({
    data: {
      ...toColumns(input),
      ingredients: { create: ingredientRowsFrom(input.ingredients) },
    },
    select: { id: true },
  })

  return recipe.id
}

/**
 * Replaces a recipe and all of its ingredient rows.
 *
 * The ingredients are deleted and recreated rather than reconciled, because the
 * text block carries no identity to match rows against. Both writes share one
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
  try {
    await db.$transaction([
      db.recipeIngredient.deleteMany({ where: { recipeId: id } }),
      db.recipe.update({
        where: { id },
        data: {
          ...toColumns(input),
          ingredients: { create: ingredientRowsFrom(input.ingredients) },
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
