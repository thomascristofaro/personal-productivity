"use server"

import { revalidatePath } from "next/cache"
import { redirect, RedirectType } from "next/navigation"

import { requireSession } from "@/lib/auth"
import { failure, type FormAction } from "@/lib/form"
import { fieldErrorsFrom, valuesFrom } from "@/lib/form-errors"
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

export const saveCatalogItem: FormAction = async (_state, formData) => {
  // Every refusal below echoes the same fields. The shared `failure` cannot
  // reach `formData`, so the alternative is spelling the echo out five times.
  const refuse = (message: string, errors?: Record<string, string[]>) =>
    failure(message, { errors, values: valuesFrom(formData, FORM_FIELDS) })

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
    return refuse("Controlla i campi segnalati.", fieldErrorsFrom(parsed.error))
  }

  await requireSession()

  const rawOriginal = formData.get("originalName")
  const original =
    typeof rawOriginal === "string" && rawOriginal !== ""
      ? CatalogItemNameSchema.safeParse(rawOriginal)
      : null

  try {
    if (original === null) {
      await createCatalogItem(parsed.data)
    } else if (original.success) {
      await updateCatalogItem(original.data, parsed.data)
    } else {
      return refuse("Questa voce non esiste più.")
    }
  } catch (error) {
    if (error instanceof CatalogItemExistsError) {
      return refuse("Controlla i campi segnalati.", {
        name: ["Esiste già una voce con questo nome."],
      })
    }
    if (error instanceof CatalogItemNotFoundError) {
      return refuse("Questa voce non esiste più.")
    }
    // The form only offers the known aisles, so reaching this means the action
    // was called directly — a server action is a public endpoint.
    if (error instanceof UnknownAisleError) {
      return refuse("Reparto non valido.")
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
