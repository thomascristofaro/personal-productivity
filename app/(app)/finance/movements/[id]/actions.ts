"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireSession } from "@/lib/auth"
import { countLabel } from "@/lib/count-label"
import { failure, type FormAction, success } from "@/lib/form"
import { fieldErrorsFrom, valuesFrom } from "@/lib/form-errors"
import {
  CategoryIdSchema,
  MovementIdSchema,
  MovementNoteSchema,
  RuleInputSchema,
} from "@/lib/schemas/finance"
import { applyRulesToPast } from "@/lib/services/finance/apply-rules"
import {
  setMovementCategory,
  setMovementNote,
} from "@/lib/services/finance/movements"
import { createRule } from "@/lib/services/finance/rules"
import { unlinkTransfer } from "@/lib/services/finance/transfers"

const NOTE_FIELDS = ["id", "note"] as const
const CATEGORY_FIELDS = ["id", "categoryId", "pattern"] as const

const UPDATED = { none: "", one: "movimento aggiornato", many: "movimenti aggiornati" }

function revalidate(id: string) {
  revalidatePath("/finance")
  revalidatePath("/finance/movements")
  revalidatePath(`/finance/movements/${id}`)
}

export const saveMovementNote: FormAction = async (_state, formData) => {
  const refuse = (message: string, errors?: Record<string, string[]>) =>
    failure(message, { errors, values: valuesFrom(formData, NOTE_FIELDS) })

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

  revalidate(id.data)

  // No redirect: the page stays open, which is why this returns a state at all.
  return success("Nota salvata.")
}

const CategoryFormSchema = z.object({
  id: MovementIdSchema,
  categoryId: CategoryIdSchema,
  remember: z.boolean(),
  backfill: z.boolean(),
  pattern: z.string(),
})

export const saveMovementCategory: FormAction = async (_state, formData) => {
  const refuse = (message: string, errors?: Record<string, string[]>) =>
    failure(message, { errors, values: valuesFrom(formData, CATEGORY_FIELDS) })

  const parsed = CategoryFormSchema.safeParse({
    id: formData.get("id"),
    categoryId: formData.get("categoryId") ?? "",
    // An unticked checkbox posts nothing at all, so the absence is what means
    // false.
    remember: formData.get("remember") !== null,
    backfill: formData.get("backfill") !== null,
    pattern: formData.get("pattern") ?? "",
  })

  if (!parsed.success) {
    return refuse("Controlla i campi segnalati.", fieldErrorsFrom(parsed.error))
  }

  // The rule's own schema, and only when a rule was asked for: a pattern left
  // untouched on a form that is not creating one must not refuse the save.
  const rule = parsed.data.remember
    ? RuleInputSchema.safeParse({
        kind: "DESCRIPTION_CONTAINS",
        pattern: parsed.data.pattern,
        categoryId: parsed.data.categoryId,
        accountId: "",
      })
    : null

  if (rule !== null && !rule.success) {
    return refuse("Controlla i campi segnalati.", fieldErrorsFrom(rule.error))
  }

  const { userId } = await requireSession()

  const written = await setMovementCategory(
    userId,
    parsed.data.id,
    parsed.data.categoryId
  )
  if (!written) return refuse("Questo movimento non esiste più.")

  const done = ["Categoria salvata."]

  if (rule !== null && rule.success) {
    await createRule(rule.data)
    done.push("Regola creata.")

    if (parsed.data.backfill) {
      const changed = await applyRulesToPast(userId)
      // Says what actually happened, including nothing: "0 movimenti
      // aggiornati" is an answer, and silence would look like a failure.
      done.push(
        changed === 0
          ? "Nessun altro movimento è cambiato."
          : countLabel(changed, UPDATED)
      )
    }
  }

  revalidate(parsed.data.id)
  revalidatePath("/finance/rules")

  return success(done.join(" "))
}

export async function unlinkMovementTransfer(movementId: string): Promise<void> {
  const id = MovementIdSchema.safeParse(movementId)
  if (!id.success) return

  const { userId } = await requireSession()
  await unlinkTransfer(userId, id.data)

  revalidate(id.data)
  revalidatePath("/finance/transfers")
}
