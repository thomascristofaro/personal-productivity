"use server"

import { revalidatePath } from "next/cache"

import type { SlotFormState } from "@/components/menu/slot-drawer"
import { requireSession } from "@/lib/auth"
import {
  DaySchema,
  MealSchema,
  SlotInputSchema,
  WeekStartSchema,
} from "@/lib/schemas/menu"
import { clearSlot, setSlot, UnknownRecipeError } from "@/lib/services/menus"

const iso = (date: Date) => date.toISOString().slice(0, 10)

// An empty numeric or text field arrives as "", which is not an absent value
// to Zod. The same helper shape app/(app)/recipes/actions.ts already uses.
function optionalNumber(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : ""
  return text === "" ? null : Number(text)
}

function optionalText(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value : ""
  return text.trim() === "" ? null : text
}

// The three fields that address the slot, parsed together: none of them is
// meaningful without the others.
function addressFrom(formData: FormData) {
  return {
    weekStart: WeekStartSchema.safeParse(formData.get("weekStart")),
    day: DaySchema.safeParse(optionalNumber(formData.get("day"))),
    meal: MealSchema.safeParse(formData.get("meal")),
  }
}

export async function saveSlot(
  _state: SlotFormState,
  formData: FormData
): Promise<SlotFormState> {
  const address = addressFrom(formData)
  const input = SlotInputSchema.safeParse({
    recipeId: optionalText(formData.get("recipeId")),
    freeText: optionalText(formData.get("freeText")),
    servings: optionalNumber(formData.get("servings")),
  })

  if (
    !address.weekStart.success ||
    !address.day.success ||
    !address.meal.success
  ) {
    return { message: "Questo slot non esiste.", ok: false }
  }

  if (!input.success) {
    return { message: input.error.issues[0].message, ok: false }
  }

  await requireSession()

  try {
    await setSlot(
      address.weekStart.data,
      address.day.data,
      address.meal.data,
      input.data
    )
  } catch (error) {
    if (error instanceof UnknownRecipeError) {
      return { message: "Questa ricetta non esiste più.", ok: false }
    }
    throw error
  }

  // No redirect: the drawer closes on `ok` and the grid re-renders in place.
  // Redirecting would throw away the scroll position on a page that is two and
  // a half screens tall. The path is built from the validated date, never from
  // the raw field — that string reaches the cache key.
  revalidatePath(`/menu/${iso(address.weekStart.data)}`)
  return { message: null, ok: true }
}

export async function emptySlot(formData: FormData): Promise<void> {
  const address = addressFrom(formData)

  if (
    !address.weekStart.success ||
    !address.day.success ||
    !address.meal.success
  ) {
    return
  }

  await requireSession()

  await clearSlot(address.weekStart.data, address.day.data, address.meal.data)

  revalidatePath(`/menu/${iso(address.weekStart.data)}`)
}
