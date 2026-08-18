"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth"
import { WeekStartSchema } from "@/lib/schemas/menu"
import { ManualItemSchema, ShoppingItemIdsSchema } from "@/lib/schemas/shopping"
import {
  addManualItem,
  NoListError,
  NoMenuError,
  regenerateShoppingList,
  removeManualItems,
  setItemChecked,
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

export async function addItem(formData: FormData): Promise<void> {
  const weekStart = WeekStartSchema.safeParse(formData.get("weekStart"))
  const input = ManualItemSchema.safeParse({
    name: formData.get("name"),
    aisle: formData.get("aisle") ?? "",
    quantity: optionalNumber(formData.get("quantity")),
    unit: optionalText(formData.get("unit")),
  })

  if (!weekStart.success || !input.success) return

  await requireSession()

  try {
    await addManualItem(weekStart.data, input.data)
  } catch (error) {
    if (!(error instanceof NoListError)) throw error
  }

  revalidatePath(`/spesa/${iso(weekStart.data)}`)
}

export async function removeItem(formData: FormData): Promise<void> {
  // Only the hand-added rows of the line are posted, so a part-generated line
  // keeps what the menu asks for.
  const ids = ShoppingItemIdsSchema.safeParse(formData.getAll("id"))
  const weekStart = WeekStartSchema.safeParse(formData.get("weekStart"))
  if (!ids.success || !weekStart.success) return

  await requireSession()

  await removeManualItems(ids.data)

  revalidatePath(`/spesa/${iso(weekStart.data)}`)
}
