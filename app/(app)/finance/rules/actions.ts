"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireSession } from "@/lib/auth"
import { countLabel } from "@/lib/count-label"
import { failure, type FormAction, success } from "@/lib/form"
import { fieldErrorsFrom, valuesFrom } from "@/lib/form-errors"
import { RuleIdSchema, RuleInputSchema } from "@/lib/schemas/finance"
import { applyRulesToPast } from "@/lib/services/finance/apply-rules"
import { createRule, deleteRule, moveRule } from "@/lib/services/finance/rules"

const FORM_FIELDS = ["kind", "pattern", "categoryId", "accountId"] as const

const UPDATED = {
  none: "",
  one: "movimento aggiornato",
  many: "movimenti aggiornati",
}

const DirectionSchema = z.enum(["up", "down"])

function revalidate() {
  revalidatePath("/finance")
  revalidatePath("/finance/movements")
  revalidatePath("/finance/rules")
}

export const addRule: FormAction = async (_state, formData) => {
  const parsed = RuleInputSchema.safeParse({
    kind: formData.get("kind") ?? "",
    pattern: formData.get("pattern") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    accountId: formData.get("accountId") ?? "",
  })

  if (!parsed.success) {
    return failure("Controlla i campi segnalati.", {
      errors: fieldErrorsFrom(parsed.error),
      values: valuesFrom(formData, FORM_FIELDS),
    })
  }

  await requireSession()
  await createRule(parsed.data)

  revalidate()

  // No redirect: the form is on the page it belongs to, and the new rule
  // appears above it.
  return success("Regola aggiunta.")
}

export async function removeRule(ruleId: string): Promise<void> {
  const id = RuleIdSchema.safeParse(ruleId)
  if (!id.success) return

  await requireSession()
  await deleteRule(id.data)

  revalidate()
}

export async function reorderRule(
  ruleId: string,
  rawDirection: string
): Promise<void> {
  const id = RuleIdSchema.safeParse(ruleId)
  const direction = DirectionSchema.safeParse(rawDirection)
  if (!id.success || !direction.success) return

  await requireSession()
  await moveRule(id.data, direction.data)

  revalidate()
}

export const runRulesOnPast: FormAction = async () => {
  const { userId } = await requireSession()
  const changed = await applyRulesToPast(userId)

  revalidate()

  // Zero is an answer. Saying nothing would read as a button that did not work.
  return success(
    changed === 0
      ? "Nessun movimento è cambiato."
      : `${countLabel(changed, UPDATED)}`
  )
}
