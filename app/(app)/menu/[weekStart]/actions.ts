"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth"
import { failure, success, type FormAction } from "@/lib/form"
import { valuesFrom } from "@/lib/form-errors"
import {
  EntryAddressSchema,
  EntryIdSchema,
  EntryInputSchema,
  WeekStartSchema,
} from "@/lib/schemas/menu"
import {
  DuplicateProposalError,
  LlmError,
  NoCandidatesError,
  proposeMenu,
} from "@/lib/services/menu-proposal"
import {
  addEntry,
  isWeekEmpty,
  replaceWeekEntries,
  UnknownEntryError,
  UnknownRecipeError,
  updateEntry,
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

// One action for both, because the drawer is one panel: an `entryId` means a
// dish already on the menu, its absence means one being added to a meal.
export const saveEntry: FormAction = async (_state, formData) => {
  const weekStart = WeekStartSchema.safeParse(formData.get("weekStart"))
  const entryId = optionalText(formData.get("entryId"))
  const input = EntryInputSchema.safeParse({
    recipeId: optionalText(formData.get("recipeId")),
    freeText: optionalText(formData.get("freeText")),
    servings: optionalNumber(formData.get("servings")),
  })

  const values = valuesFrom(formData, ["freeText", "servings"])

  if (!weekStart.success) {
    return failure("Questa settimana non esiste.", { values })
  }

  if (!input.success) {
    return failure(input.error.issues[0].message, { values })
  }

  await requireSession()

  try {
    if (entryId === null) {
      const at = EntryAddressSchema.safeParse({
        day: optionalNumber(formData.get("day")),
        meal: formData.get("meal"),
      })

      if (!at.success) return failure("Questo pasto non esiste.", { values })

      await addEntry(weekStart.data, at.data, input.data)
    } else {
      const id = EntryIdSchema.safeParse(entryId)

      if (!id.success) return failure(id.error.issues[0].message, { values })

      await updateEntry(id.data, input.data)
    }
  } catch (error) {
    if (error instanceof UnknownRecipeError) {
      return failure("Questa ricetta non esiste più.", { values })
    }
    if (error instanceof UnknownEntryError) {
      return failure("Questo piatto è stato tolto. Ricarica la pagina.", {
        values,
      })
    }
    throw error
  }

  // No redirect: the drawer closes on `ok` and the grid re-renders in place.
  // Redirecting would throw away the scroll position on a page that is two and
  // a half screens tall. The path is built from the validated date, never from
  // the raw field — that string reaches the cache key.
  revalidatePath(`/menu/${iso(weekStart.data)}`)
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
    const entries = await proposeMenu(parsed.data)

    // One transaction rather than a write per dish: a failure halfway would
    // leave a week that is neither the old one nor the new one.
    await replaceWeekEntries(parsed.data, entries)
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
