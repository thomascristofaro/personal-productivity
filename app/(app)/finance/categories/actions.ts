"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth"
import { failure, type FormAction, success } from "@/lib/form"
import { fieldErrorsFrom, valuesFrom } from "@/lib/form-errors"
import { CategoryIdSchema, CategoryInputSchema } from "@/lib/schemas/finance"
import {
  CategoryExistsError,
  createCategory,
  updateCategory,
} from "@/lib/services/finance/categories"

const FORM_FIELDS = ["id", "name", "kind", "archived"] as const

export const saveCategory: FormAction = async (_state, formData) => {
  const refuse = (message: string, errors?: Record<string, string[]>) =>
    failure(message, { errors, values: valuesFrom(formData, FORM_FIELDS) })

  const parsed = CategoryInputSchema.safeParse({
    name: formData.get("name") ?? "",
    kind: formData.get("kind") ?? "",
    // An unticked checkbox posts nothing at all, so the absence is what means
    // false.
    archived: formData.get("archived") !== null,
  })

  if (!parsed.success) {
    return refuse("Controlla i campi segnalati.", fieldErrorsFrom(parsed.error))
  }

  await requireSession()

  const rawId = formData.get("id")
  const id =
    typeof rawId === "string" && rawId !== ""
      ? CategoryIdSchema.safeParse(rawId)
      : null

  try {
    if (id === null) {
      await createCategory(parsed.data)
    } else if (id.success) {
      await updateCategory(id.data, parsed.data)
    } else {
      return refuse("Questa categoria non esiste più.")
    }
  } catch (error) {
    if (error instanceof CategoryExistsError) {
      return refuse("Controlla i campi segnalati.", {
        name: ["Esiste già una categoria con questo nome."],
      })
    }
    throw error
  }

  revalidatePath("/finance")
  revalidatePath("/finance/movements")
  revalidatePath("/finance/rules")
  revalidatePath("/finance/categories")

  return success(id === null ? "Categoria aggiunta." : "Categoria salvata.")
}
