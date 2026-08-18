"use server"

import { revalidatePath } from "next/cache"

import type { TotalState } from "@/components/shopping/purchase-total-form"
import { requireSession } from "@/lib/auth"
import { EuroCentsSchema, PurchaseIdSchema } from "@/lib/schemas/shopping"
import { setPurchaseTotal } from "@/lib/services/purchases"

export async function saveTotal(
  _state: TotalState,
  formData: FormData
): Promise<TotalState> {
  const id = PurchaseIdSchema.safeParse(formData.get("id"))
  const total = EuroCentsSchema.safeParse(formData.get("total") ?? "")

  if (!id.success) return { message: "Questa spesa non è valida." }
  if (!total.success) return { message: total.error.issues[0].message }

  await requireSession()

  await setPurchaseTotal(id.data, total.data)

  revalidatePath("/spesa/storico")
  revalidatePath(`/spesa/storico/${id.data}`)
  return { message: null }
}
