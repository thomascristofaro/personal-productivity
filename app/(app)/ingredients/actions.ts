"use server"

import { revalidatePath } from "next/cache"
import { redirect, RedirectType } from "next/navigation"
import { z } from "zod"

import type { IngredientFormState } from "@/components/ingredients/ingredient-form"
import { requireSession } from "@/lib/auth"
import {
  CatalogItemInputSchema,
  CatalogItemNameSchema,
} from "@/lib/schemas/catalog"
import {
  createFullIngredient,
  deleteIngredient,
  IngredientExistsError,
  IngredientInUseError,
  IngredientNotFoundError,
  UnknownAisleError,
  updateIngredient,
} from "@/lib/services/ingredients"

const FORM_FIELDS = ["originalName", "name", "defaultUnit", "aisle"] as const

// Echoes exactly what was submitted, so a failed save re-renders the form from
// these values instead of losing them to React 19's form reset.
function valuesFrom(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {}

  for (const field of FORM_FIELDS) {
    const value = formData.get(field)
    values[field] = typeof value === "string" ? value : ""
  }

  return values
}

// Built from `issues` rather than a version-specific flatten helper — the same
// shape app/(app)/recipes/actions.ts already uses.
function fieldErrorsFrom(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {}

  for (const issue of error.issues) {
    const field = issue.path[0]
    if (typeof field !== "string") continue
    errors[field] = [...(errors[field] ?? []), issue.message]
  }

  return errors
}

export async function saveIngredient(
  _state: IngredientFormState,
  formData: FormData
): Promise<IngredientFormState> {
  const parsed = CatalogItemInputSchema.safeParse({
    name: formData.get("name"),
    defaultUnit: formData.get("defaultUnit") ?? "",
    aisle: formData.get("aisle") ?? "",
  })

  if (!parsed.success) {
    return {
      errors: fieldErrorsFrom(parsed.error),
      message: "Controlla i campi segnalati.",
      values: valuesFrom(formData),
    }
  }

  await requireSession()

  const rawOriginal = formData.get("originalName")
  const original =
    typeof rawOriginal === "string" && rawOriginal !== ""
      ? CatalogItemNameSchema.safeParse(rawOriginal)
      : null

  const failure = (message: string): IngredientFormState => ({
    errors: {},
    message,
    values: valuesFrom(formData),
  })

  try {
    if (original === null) {
      await createFullIngredient(parsed.data)
    } else if (original.success) {
      await updateIngredient(original.data, parsed.data)
    } else {
      return failure("Questo ingrediente non esiste più.")
    }
  } catch (error) {
    if (error instanceof IngredientExistsError) {
      return {
        errors: { name: ["Esiste già un ingrediente con questo nome."] },
        message: "Controlla i campi segnalati.",
        values: valuesFrom(formData),
      }
    }
    if (error instanceof IngredientNotFoundError) {
      return failure("Questo ingrediente non esiste più.")
    }
    // The form only offers the known aisles, so reaching this means the action
    // was called directly — a server action is a public endpoint.
    if (error instanceof UnknownAisleError) {
      return failure("Reparto non valido.")
    }
    throw error
  }

  revalidatePath("/ingredients")
  revalidatePath("/recipes")
  // Replace, not push: `redirect` defaults to push inside a Server Action, and
  // Back would then land on the form that was just submitted.
  redirect("/ingredients", RedirectType.replace)
}

export async function removeIngredient(name: string): Promise<void> {
  const parsed = CatalogItemNameSchema.safeParse(name)
  if (!parsed.success) return

  await requireSession()

  try {
    await deleteIngredient(parsed.data)
  } catch (error) {
    // In use: the page only offers the button when nothing uses it, so getting
    // here means a direct call or a race with someone saving a recipe. Falling
    // through re-renders the list with the ingredient still on it and the
    // "è usato in N ricette" line, which is the honest outcome.
    // Already gone: the caller's intent is satisfied either way.
    if (
      !(error instanceof IngredientInUseError) &&
      !(error instanceof IngredientNotFoundError)
    ) {
      throw error
    }
  }

  revalidatePath("/ingredients")
  redirect("/ingredients", RedirectType.replace)
}
