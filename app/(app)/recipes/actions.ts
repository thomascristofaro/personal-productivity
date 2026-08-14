"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import type { RecipeFormState } from "@/components/recipes/recipe-form-state"
import { requireSession } from "@/lib/auth"
import { RecipeInputSchema } from "@/lib/schemas/recipe"
import {
  createRecipe,
  deleteRecipe,
  RecipeNotFoundError,
  updateRecipe,
} from "@/lib/services/recipes"

const RecipeIdSchema = z.cuid()

// An empty numeric field arrives as "", which is not an absent value to Zod.
function optionalNumber(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : ""
  return text === "" ? undefined : Number(text)
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
    tags: formData.get("tags") ?? "",
    ingredients: formData.get("ingredients"),
  })

  if (!parsed.success) {
    return {
      errors: fieldErrorsFrom(parsed.error),
      message: "Controlla i campi segnalati.",
    }
  }

  await requireSession()

  const rawId = formData.get("id")
  const existing =
    typeof rawId === "string" && rawId !== ""
      ? RecipeIdSchema.safeParse(rawId)
      : null

  let target: string

  if (existing === null) {
    target = await createRecipe(parsed.data)
  } else if (existing.success) {
    try {
      await updateRecipe(existing.data, parsed.data)
    } catch (error) {
      if (error instanceof RecipeNotFoundError) {
        return { errors: {}, message: "Questa ricetta non esiste più." }
      }
      throw error
    }
    target = existing.data
  } else {
    return { errors: {}, message: "Questa ricetta non esiste più." }
  }

  revalidatePath("/recipes")
  revalidatePath(`/recipes/${target}`)
  redirect(`/recipes/${target}`)
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
  redirect("/recipes")
}
