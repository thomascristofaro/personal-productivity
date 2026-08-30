"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth"
import { failure, success, type FormAction } from "@/lib/form"
import { valuesFrom } from "@/lib/form-errors"
import {
  SlotAddressSchema,
  SlotInputSchema,
  WeekStartSchema,
} from "@/lib/schemas/menu"
import {
  DuplicateProposalError,
  LlmError,
  NoCandidatesError,
  proposeMenu,
} from "@/lib/services/menu-proposal"
import {
  isWeekEmpty,
  replaceWeekSlots,
  setSlot,
  UnknownRecipeError,
} from "@/lib/services/menus"

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

// The four fields that address the slot, parsed together: none of them is
// meaningful without the others.
function addressFrom(formData: FormData) {
  return {
    weekStart: WeekStartSchema.safeParse(formData.get("weekStart")),
    address: SlotAddressSchema.safeParse({
      day: optionalNumber(formData.get("day")),
      meal: formData.get("meal"),
      course: formData.get("course"),
    }),
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

  if (!address.weekStart.success || !address.address.success) {
    return failure("Questo slot non esiste.", { values })
  }

  if (!input.success) {
    return failure(input.error.issues[0].message, { values })
  }

  await requireSession()

  try {
    await setSlot(address.weekStart.data, address.address.data, input.data)
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
 * Fills a week with a generated proposal.
 *
 * Not a `FormAction`: it is invoked from a button rather than a form, so it
 * takes its arguments directly and answers with a message or nothing.
 *
 * `overwrite` is the caller stating intent, not the caller being trusted: the
 * week's emptiness is re-read here, because the page hides the button on a
 * filled week and a hidden button protects nothing. Without the flag a filled
 * week is refused and the caller is expected to ask the user first.
 */
export async function generateWeek(
  weekStart: string,
  overwrite = false
): Promise<{ error: string } | void> {
  const parsed = WeekStartSchema.safeParse(weekStart)
  if (!parsed.success) return { error: "Questa settimana non esiste." }

  await requireSession()

  if (!overwrite && !(await isWeekEmpty(parsed.data))) {
    return { error: "Questa settimana ha già dei pasti. Ricarica la pagina." }
  }

  try {
    const slots = await proposeMenu(parsed.data)

    // One transaction rather than fourteen writes: a failure halfway would
    // leave a week that is neither the old one nor the new one.
    await replaceWeekSlots(parsed.data, slots)
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
    if (error instanceof UnknownRecipeError) {
      return { error: "Una ricetta è stata eliminata. Riprova." }
    }
    throw error
  }

  revalidatePath(`/menu/${iso(parsed.data)}`)
}
