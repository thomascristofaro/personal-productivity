"use server"

import { revalidatePath } from "next/cache"
import { redirect, RedirectType } from "next/navigation"
import { z } from "zod"

import type { RecipeFormState } from "@/components/recipes/recipe-form-state"
import { requireSession } from "@/lib/auth"
import { CatalogItemNameSchema } from "@/lib/schemas/catalog"
import { RecipeInputSchema } from "@/lib/schemas/recipe"
import {
  CatalogItemExistsError,
  createIngredient,
  findIngredientByName,
  type IngredientOption,
} from "@/lib/services/catalog"
import {
  createRecipe,
  deleteRecipe,
  RecipeNotFoundError,
  UnknownIngredientError,
  updateRecipe,
} from "@/lib/services/recipes"

const RecipeIdSchema = z.cuid()

// Only the flat fields. Ingredients and tags are held in React state by their
// components, so they survive React 19's form reset without being echoed.
const FORM_FIELDS = [
  "title",
  "sourceUrl",
  "servings",
  "totalMinutes",
  "instructions",
  "notes",
] as const

// An empty numeric field arrives as "", which is not an absent value to Zod.
function optionalNumber(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : ""
  return text === "" ? undefined : Number(text)
}

// Echoes exactly what was submitted, so a failed save can re-render the form
// from these values instead of losing them to React's form reset — see
// components/recipes/recipe-form-state.ts.
function valuesFrom(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {}

  for (const field of FORM_FIELDS) {
    const value = formData.get(field)
    values[field] = typeof value === "string" ? value : ""
  }

  const id = formData.get("id")
  if (typeof id === "string") values.id = id

  return values
}

// The form renders one set of identically-named inputs per row, so the three
// arrays are index-aligned by DOM order. Every row always renders all three
// inputs, including empty ones, which is what keeps them the same length.
function ingredientRowsFrom(formData: FormData) {
  const names = formData.getAll("ingredientName")
  const units = formData.getAll("unit")
  const quantities = formData.getAll("quantity")

  return names.map((name, index) => {
    const unit = units[index]
    return {
      ingredientName: typeof name === "string" ? name : "",
      unit: typeof unit === "string" ? unit : null,
      quantity: optionalNumber(quantities[index] ?? null) ?? null,
    }
  })
}

function tagsFrom(formData: FormData): string[] {
  return formData
    .getAll("tags")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

// Built from `issues` rather than a version-specific flatten helper.
function fieldErrorsFrom(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {}

  for (const issue of error.issues) {
    const field = issue.path[0]
    if (typeof field !== "string") continue
    errors[field] = [...(errors[field] ?? []), issue.message]
  }

  return errors
}

export async function saveRecipe(
  _state: RecipeFormState,
  formData: FormData
): Promise<RecipeFormState> {
  const parsed = RecipeInputSchema.safeParse({
    title: formData.get("title"),
    sourceUrl: formData.get("sourceUrl") ?? "",
    servings: optionalNumber(formData.get("servings")),
    totalMinutes: optionalNumber(formData.get("totalMinutes")),
    instructions: formData.get("instructions") ?? "",
    notes: formData.get("notes") ?? "",
    tags: tagsFrom(formData),
    ingredients: ingredientRowsFrom(formData),
  })

  if (!parsed.success) {
    return {
      errors: fieldErrorsFrom(parsed.error),
      message: "Controlla i campi segnalati.",
      values: valuesFrom(formData),
    }
  }

  await requireSession()

  const rawId = formData.get("id")
  const existing =
    typeof rawId === "string" && rawId !== ""
      ? RecipeIdSchema.safeParse(rawId)
      : null

  const missingIngredient = {
    errors: {},
    message: "Uno degli ingredienti non esiste più. Ricarica la pagina.",
    values: valuesFrom(formData),
  }

  let target: string

  if (existing === null) {
    try {
      target = await createRecipe(parsed.data)
    } catch (error) {
      if (error instanceof UnknownIngredientError) return missingIngredient
      throw error
    }
  } else if (existing.success) {
    try {
      await updateRecipe(existing.data, parsed.data)
    } catch (error) {
      if (error instanceof RecipeNotFoundError) {
        return {
          errors: {},
          message: "Questa ricetta non esiste più.",
          values: valuesFrom(formData),
        }
      }
      if (error instanceof UnknownIngredientError) return missingIngredient
      throw error
    }
    target = existing.data
  } else {
    return {
      errors: {},
      message: "Questa ricetta non esiste più.",
      values: valuesFrom(formData),
    }
  }

  revalidatePath("/recipes")
  revalidatePath(`/recipes/${target}`)
  // `redirect` defaults to `push` inside a Server Action — see
  // node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md.
  // Pushing would leave the just-submitted form in the history, so Back from a
  // new recipe lands on an empty create form instead of the list.
  redirect(`/recipes/${target}`, RedirectType.replace)
}

/**
 * Adds an ingredient to the catalogue from inside the recipe form.
 *
 * Returns null rather than throwing on a bad name: the caller is a picker, and
 * the only thing it can do is leave the row empty.
 */
export async function addIngredient(
  name: string
): Promise<IngredientOption | null> {
  const parsed = CatalogItemNameSchema.safeParse(name)
  if (!parsed.success) return null

  await requireSession()

  try {
    return await createIngredient(parsed.data)
  } catch (error) {
    // Someone else added the same name between the search and the tap. The
    // caller's intent is satisfied by the row that already exists.
    if (error instanceof CatalogItemExistsError) {
      return await findIngredientByName(parsed.data)
    }
    throw error
  }
}

export async function removeRecipe(id: string): Promise<void> {
  const parsed = RecipeIdSchema.safeParse(id)
  if (!parsed.success) return

  await requireSession()

  try {
    await deleteRecipe(parsed.data)
  } catch (error) {
    // Already gone — the caller's intent (no such recipe) is satisfied either
    // way, so this redirects like a normal success rather than surfacing an
    // error for a delete that already happened.
    if (!(error instanceof RecipeNotFoundError)) throw error
  }

  revalidatePath("/recipes")
  // Replace, so Back after a delete does not land on the deleted recipe's 404.
  redirect("/recipes", RedirectType.replace)
}
