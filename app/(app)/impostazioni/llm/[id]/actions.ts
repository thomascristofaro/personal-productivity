"use server"

import { revalidatePath } from "next/cache"

import { requireOwner } from "@/lib/auth/owner"
import { failure, success, type FormAction } from "@/lib/form"
import { fieldErrorsFrom, valuesFrom } from "@/lib/form-errors"
import { LlmFunctionInputSchema } from "@/lib/schemas/llm-function"
import { updateFunction } from "@/lib/services/llm-registry"

const FORM_FIELDS = ["prompt", "model", "temperature", "maxTokens"] as const

// An empty numeric field arrives as "", which is not an absent value to Zod.
function number(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : ""
  return text === "" ? undefined : Number(text)
}

export const saveFunction: FormAction = async (_state, formData) => {
  const parsed = LlmFunctionInputSchema.safeParse({
    prompt: formData.get("prompt"),
    model: formData.get("model"),
    temperature: number(formData.get("temperature")),
    maxTokens: number(formData.get("maxTokens")),
  })

  const values = valuesFrom(formData, FORM_FIELDS)

  if (!parsed.success) {
    return failure("Controlla i campi segnalati.", {
      errors: fieldErrorsFrom(parsed.error),
      values,
    })
  }

  // Validate, then authenticate and authorise, then mutate. The page's own
  // requireOwner does not protect this: an action is a public endpoint.
  await requireOwner()

  const id = String(formData.get("id"))
  await updateFunction(id, parsed.data)

  revalidatePath(`/impostazioni/llm/${id}`)
  return success("Impostazioni salvate.")
}
