"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth"
import { failure, success } from "@/lib/form"
import { valuesFrom } from "@/lib/form-errors"
import type { FormAction } from "@/lib/form"
import { EuroCentsSchema, PurchaseIdSchema } from "@/lib/schemas/shopping"
import { setPurchaseTotal } from "@/lib/services/purchases"

export const saveTotal: FormAction = async (_state, formData) => {
  const id = PurchaseIdSchema.safeParse(formData.get("id"))
  const total = EuroCentsSchema.safeParse(formData.get("total") ?? "")

  if (!id.success) return failure("Questa spesa non è valida.")
  if (!total.success) {
    return failure(total.error.issues[0].message, {
      values: valuesFrom(formData, ["total"]),
    })
  }

  await requireSession()
  await setPurchaseTotal(id.data, total.data)

  revalidatePath("/spesa/storico")
  revalidatePath(`/spesa/storico/${id.data}`)
  return success()
}
