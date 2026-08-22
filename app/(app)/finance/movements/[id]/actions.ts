"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth"
import { failure, type FormAction, success } from "@/lib/form"
import { valuesFrom } from "@/lib/form-errors"
import { MovementIdSchema, MovementNoteSchema } from "@/lib/schemas/finance"
import { setMovementNote } from "@/lib/services/finance/movements"

const FORM_FIELDS = ["id", "note"] as const

export const saveMovementNote: FormAction = async (_state, formData) => {
  const refuse = (message: string, errors?: Record<string, string[]>) =>
    failure(message, { errors, values: valuesFrom(formData, FORM_FIELDS) })

  const parsed = MovementNoteSchema.safeParse(formData.get("note") ?? "")
  if (!parsed.success) {
    // A bare string schema, so its issues carry no path and fieldErrorsFrom
    // would drop them. The one field on the form is named here instead.
    return refuse("Controlla i campi segnalati.", {
      note: parsed.error.issues.map((issue) => issue.message),
    })
  }

  const id = MovementIdSchema.safeParse(formData.get("id"))
  if (!id.success) return refuse("Questo movimento non esiste più.")

  const { userId } = await requireSession()

  // False means the id matched nothing the user can see — a direct call, or a
  // movement removed with its account. Same answer either way.
  const written = await setMovementNote(userId, id.data, parsed.data)
  if (!written) return refuse("Questo movimento non esiste più.")

  revalidatePath(`/finance/movements/${id.data}`)

  // No redirect: the page stays open, which is why this returns a state at all.
  return success("Nota salvata.")
}
