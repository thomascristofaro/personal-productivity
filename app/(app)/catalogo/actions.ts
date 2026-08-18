"use server"

import { revalidatePath } from "next/cache"
import { redirect, RedirectType } from "next/navigation"
import { z } from "zod"

import type { CatalogFormState } from "@/components/catalog/catalog-form"
import { requireSession } from "@/lib/auth"
import {
  CatalogItemInputSchema,
  CatalogItemNameSchema,
} from "@/lib/schemas/catalog"
import {
  CatalogItemExistsError,
  CatalogItemInUseError,
  CatalogItemNotFoundError,
  createCatalogItem,
  deleteCatalogItem,
  UnknownAisleError,
  updateCatalogItem,
} from "@/lib/services/catalog"

const FORM_FIELDS = [
  "originalName",
  "name",
  "kind",
  "defaultUnit",
  "aisle",
] as const

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

export async function saveCatalogItem(
  _state: CatalogFormState,
  formData: FormData
): Promise<CatalogFormState> {
  const parsed = CatalogItemInputSchema.safeParse({
    name: formData.get("name"),
    // `?? undefined` and not `?? ""`: the schema defaults a missing kind to
    // INGREDIENT, and an empty string would instead fail the enum with a
    // message no user could act on.
    kind: formData.get("kind") ?? undefined,
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

  const failure = (message: string): CatalogFormState => ({
    errors: {},
    message,
    values: valuesFrom(formData),
  })

  try {
    if (original === null) {
      await createCatalogItem(parsed.data)
    } else if (original.success) {
      await updateCatalogItem(original.data, parsed.data)
    } else {
      return failure("Questa voce non esiste più.")
    }
  } catch (error) {
    if (error instanceof CatalogItemExistsError) {
      return {
        errors: { name: ["Esiste già una voce con questo nome."] },
        message: "Controlla i campi segnalati.",
        values: valuesFrom(formData),
      }
    }
    if (error instanceof CatalogItemNotFoundError) {
      return failure("Questa voce non esiste più.")
    }
    // The form only offers the known aisles, so reaching this means the action
    // was called directly — a server action is a public endpoint.
    if (error instanceof UnknownAisleError) {
      return failure("Reparto non valido.")
    }
    throw error
  }

  revalidatePath("/catalogo")
  revalidatePath("/recipes")
  // Replace, not push: `redirect` defaults to push inside a Server Action, and
  // Back would then land on the form that was just submitted.
  redirect("/catalogo", RedirectType.replace)
}

export async function removeCatalogItem(name: string): Promise<void> {
  const parsed = CatalogItemNameSchema.safeParse(name)
  if (!parsed.success) return

  await requireSession()

  try {
    await deleteCatalogItem(parsed.data)
  } catch (error) {
    // In use: the page only offers the button when nothing uses it, so getting
    // here means a direct call or a race with someone saving a recipe. Falling
    // through re-renders the list with the entry still on it and the
    // "è usato in N ricette" line, which is the honest outcome.
    // Already gone: the caller's intent is satisfied either way.
    if (
      !(error instanceof CatalogItemInUseError) &&
      !(error instanceof CatalogItemNotFoundError)
    ) {
      throw error
    }
  }

  revalidatePath("/catalogo")
  redirect("/catalogo", RedirectType.replace)
}
