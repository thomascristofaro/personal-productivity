"use server"

import { revalidatePath } from "next/cache"
import { redirect, RedirectType } from "next/navigation"

import { requireSession } from "@/lib/auth"
import { failure, type FormAction } from "@/lib/form"
import { fieldErrorsFrom, valuesFrom } from "@/lib/form-errors"
import {
  FinanceAccountIdSchema,
  FinanceAccountInputSchema,
} from "@/lib/schemas/finance"
import { AccountNotVisibleError } from "@/lib/services/finance/access"
import { createAccount, updateAccount } from "@/lib/services/finance/accounts"

const FORM_FIELDS = [
  "id",
  "name",
  "provider",
  "openingBalance",
  "openingBalanceAt",
  "shared",
] as const

export const saveFinanceAccount: FormAction = async (_state, formData) => {
  // Every refusal below echoes the same fields. The shared `failure` cannot
  // reach `formData`, so the alternative is spelling the echo out five times.
  const refuse = (message: string, errors?: Record<string, string[]>) =>
    failure(message, { errors, values: valuesFrom(formData, FORM_FIELDS) })

  const parsed = FinanceAccountInputSchema.safeParse({
    name: formData.get("name") ?? "",
    provider: formData.get("provider") ?? "",
    // An unticked checkbox posts nothing at all, so the absence is what means
    // false. The schema stays honest about having been handed a boolean.
    shared: formData.get("shared") !== null,
    openingBalanceCents: formData.get("openingBalance") ?? "",
    openingBalanceAt: formData.get("openingBalanceAt") ?? "",
  })

  if (!parsed.success) {
    const errors = fieldErrorsFrom(parsed.error)
    return refuse("Controlla i campi segnalati.", {
      ...errors,
      // The schema's key and the form's field name differ, so the error would
      // land on a field that is not on screen.
      ...(errors.openingBalanceCents === undefined
        ? {}
        : { openingBalance: errors.openingBalanceCents }),
    })
  }

  const { userId } = await requireSession()

  const rawId = formData.get("id")
  const id =
    typeof rawId === "string" && rawId !== ""
      ? FinanceAccountIdSchema.safeParse(rawId)
      : null

  try {
    if (id === null) {
      await createAccount(userId, parsed.data)
    } else if (id.success) {
      await updateAccount(userId, id.data, parsed.data)
    } else {
      return refuse("Questo conto non esiste più.")
    }
  } catch (error) {
    // The form only offers accounts the user can see, so reaching this means
    // the action was called directly — a server action is a public endpoint.
    if (error instanceof AccountNotVisibleError) {
      return refuse("Questo conto non esiste più.")
    }
    throw error
  }

  revalidatePath("/finance")
  revalidatePath("/finance/accounts")
  // Replace, not push: `redirect` defaults to push inside a Server Action, and
  // Back would then land on the form that was just submitted.
  redirect("/finance/accounts", RedirectType.replace)
}
