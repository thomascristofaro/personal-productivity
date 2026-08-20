"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth"
import { failure, success, type FormAction } from "@/lib/form"
import { valuesFrom } from "@/lib/form-errors"
import { WeekStartSchema } from "@/lib/schemas/menu"
import {
  AddShoppingItemSchema,
  EuroCentsSchema,
  ShoppingItemIdsSchema,
  TakenQuantitySchema,
} from "@/lib/schemas/shopping"
import { completePurchase, NothingCheckedError } from "@/lib/services/purchases"
import {
  addManualItem,
  NoListError,
  NoMenuError,
  regenerateShoppingList,
  removeFromList,
  restoreToList,
  setItemChecked,
  setItemTaken,
} from "@/lib/services/shopping-lists"

const iso = (date: Date) => date.toISOString().slice(0, 10)

function optionalNumber(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : ""
  return text === "" ? null : Number(text)
}

function optionalText(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value : ""
  return text.trim() === "" ? null : text
}

export async function regenerate(formData: FormData): Promise<void> {
  const weekStart = WeekStartSchema.safeParse(formData.get("weekStart"))
  if (!weekStart.success) return

  await requireSession()

  try {
    await regenerateShoppingList(weekStart.data)
  } catch (error) {
    // A week with no menu has nothing to aggregate. The page only offers the
    // button when a menu exists, so getting here means a direct call or a race;
    // re-rendering shows the empty state again, which is the truth.
    if (!(error instanceof NoMenuError)) throw error
  }

  revalidatePath(`/spesa/${iso(weekStart.data)}`)
}

export async function toggle(formData: FormData): Promise<void> {
  // getAll, not get: one line on the screen is every row behind it.
  const ids = ShoppingItemIdsSchema.safeParse(formData.getAll("id"))
  const weekStart = WeekStartSchema.safeParse(formData.get("weekStart"))
  if (!ids.success || !weekStart.success) return

  // The identity comes from the session and never from the form: a client that
  // could name the ticker could tick as the other user.
  const session = await requireSession()

  try {
    await setItemChecked(
      ids.data,
      session.userId,
      formData.get("checked") === "1"
    )
  } catch (error) {
    // The rows went away under us — a regeneration between the render and the
    // tap. Re-rendering shows the list as it now is.
    if (!(error instanceof NoListError)) throw error
  }

  revalidatePath(`/spesa/${iso(weekStart.data)}`)
}

export const addItem: FormAction = async (_state, formData) => {
  const weekStart = WeekStartSchema.safeParse(formData.get("weekStart"))
  const input = AddShoppingItemSchema.safeParse({
    name: formData.get("name"),
    aisle: formData.get("aisle") ?? "",
    quantity: optionalNumber(formData.get("quantity")),
    unit: optionalText(formData.get("unit")),
    // An unticked checkbox posts nothing at all, so absent means "remember" —
    // the box reads «Non salvare nel catalogo» and starts unticked.
    remember: formData.get("skipCatalog") === null,
    kind: formData.get("kind") ?? "PRODUCT",
  })

  const values = valuesFrom(formData, ["quantity", "unit", "aisle", "kind"])

  if (!weekStart.success) {
    return failure("Settimana non valida.", { values })
  }
  if (!input.success) {
    return failure(input.error.issues[0]?.message ?? "Controlla i campi.", {
      values,
    })
  }

  await requireSession()

  try {
    await addManualItem(weekStart.data, input.data)
  } catch (error) {
    // The previous version swallowed every refusal and re-rendered as if
    // nothing had happened, which is how a line can fail to appear without a
    // word being said about it.
    if (error instanceof NoListError) {
      return failure("Questa settimana non ha una lista.", { values })
    }
    throw error
  }

  revalidatePath(`/spesa/${iso(weekStart.data)}`)
  return success()
}

export async function removeItem(formData: FormData): Promise<void> {
  // Every row behind the line, not only the hand-added ones: the bin means "I
  // am not buying this", and half a line left behind would not say that.
  const ids = ShoppingItemIdsSchema.safeParse(formData.getAll("id"))
  const weekStart = WeekStartSchema.safeParse(formData.get("weekStart"))
  if (!ids.success || !weekStart.success) return

  await requireSession()

  await removeFromList(ids.data)

  revalidatePath(`/spesa/${iso(weekStart.data)}`)
}

export async function restoreItem(formData: FormData): Promise<void> {
  const ids = ShoppingItemIdsSchema.safeParse(formData.getAll("id"))
  const weekStart = WeekStartSchema.safeParse(formData.get("weekStart"))
  if (!ids.success || !weekStart.success) return

  await requireSession()

  await restoreToList(ids.data)

  revalidatePath(`/spesa/${iso(weekStart.data)}`)
}

export async function setTaken(formData: FormData): Promise<void> {
  const ids = ShoppingItemIdsSchema.safeParse(formData.getAll("id"))
  const weekStart = WeekStartSchema.safeParse(formData.get("weekStart"))
  const taken = TakenQuantitySchema.safeParse(
    optionalNumber(formData.get("taken"))
  )
  if (!ids.success || !weekStart.success || !taken.success) return

  await requireSession()

  try {
    await setItemTaken(ids.data, taken.data)
  } catch (error) {
    // The rows went away under us — a regeneration, or the other phone closing
    // the shop, between the render and the tap.
    if (!(error instanceof NoListError)) throw error
  }

  revalidatePath(`/spesa/${iso(weekStart.data)}`)
}

export const complete: FormAction = async (_state, formData) => {
  const weekStart = WeekStartSchema.safeParse(formData.get("weekStart"))
  const total = EuroCentsSchema.safeParse(formData.get("total") ?? "")

  // The drawer remounts its field group on every attempt, so a refusal that
  // does not echo empties the amount. This one is typed at the till, from a
  // receipt already back in a pocket.
  const values = valuesFrom(formData, ["total"])

  if (!weekStart.success) return failure("Settimana non valida.", { values })
  if (!total.success) {
    return failure(total.error.issues[0].message, { values })
  }

  await requireSession()

  try {
    await completePurchase(weekStart.data, total.data)
  } catch (error) {
    if (error instanceof NoListError) {
      return failure("Questa settimana non ha una lista.", { values })
    }
    // The other phone closed the shop first, or unticked everything between the
    // render and the tap. Saying so beats a silent no-op.
    if (error instanceof NothingCheckedError) {
      return failure("Non c’è niente di spuntato.", { values })
    }
    throw error
  }

  revalidatePath(`/spesa/${iso(weekStart.data)}`)
  revalidatePath("/spesa/storico")
  return success()
}
