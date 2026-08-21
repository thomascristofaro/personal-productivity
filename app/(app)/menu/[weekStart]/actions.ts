"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth"
import { failure, success, type FormAction } from "@/lib/form"
import { valuesFrom } from "@/lib/form-errors"
import {
  DaySchema,
  MealSchema,
  SlotInputSchema,
  WeekStartSchema,
} from "@/lib/schemas/menu"
import {
  DuplicateProposalError,
  LlmError,
  NoCandidatesError,
  proposeMenu,
} from "@/lib/services/menu-proposal"
import { setSlot, UnknownRecipeError } from "@/lib/services/menus"

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

export const saveSlot: FormAction = async (_state, formData) => {
  const address = addressFrom(formData)
  const input = SlotInputSchema.safeParse({
    recipeId: optionalText(formData.get("recipeId")),
    freeText: optionalText(formData.get("freeText")),
    servings: optionalNumber(formData.get("servings")),
  })

  const values = valuesFrom(formData, ["freeText", "servings"])

  if (
    !address.weekStart.success ||
    !address.day.success ||
    !address.meal.success
  ) {
    return failure("Questo slot non esiste.", { values })
  }

  if (!input.success) {
    return failure(input.error.issues[0].message, { values })
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
      return failure("Questa ricetta non esiste più.", { values })
    }
    throw error
  }

  // No redirect: the drawer closes on `ok` and the grid re-renders in place.
  // Redirecting would throw away the scroll position on a page that is two and
  // a half screens tall. The path is built from the validated date, never from
  // the raw field — that string reaches the cache key.
  revalidatePath(`/menu/${iso(address.weekStart.data)}`)
  return success()
}

/**
 * Fills an empty week with a proposal.
 *
 * Not a `FormAction`: it is invoked from a button rather than a form, so it
 * takes the week directly and answers with a message or nothing. The write is
 * safe because the caller only offers it on a week where every slot is empty —
 * there is nothing here to overwrite.
 */
export async function generateWeek(
  weekStart: string
): Promise<{ error: string } | void> {
  const parsed = WeekStartSchema.safeParse(weekStart)
  if (!parsed.success) return { error: "Questa settimana non esiste." }

  await requireSession()

  try {
    const slots = await proposeMenu(parsed.data)

    for (const slot of slots) {
      await setSlot(parsed.data, slot.day, slot.meal, {
        recipeId: slot.recipeId,
        freeText: null,
        servings: null,
      })
    }
  } catch (error) {
    if (error instanceof NoCandidatesError) {
      return { error: "Aggiungi qualche ricetta prima di generare un menù." }
    }
    if (error instanceof DuplicateProposalError) {
      return { error: "Il menù proposto ripeteva un piatto. Riprova." }
    }
    if (error instanceof LlmError) {
      return { error: "Non sono riuscito a generare il menù. Riprova." }
    }
    throw error
  }

  revalidatePath(`/menu/${iso(parsed.data)}`)
}
