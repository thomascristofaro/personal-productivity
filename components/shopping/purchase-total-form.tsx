"use client"

import { TextField } from "@/components/page/fields"
import { FormMessage } from "@/components/page/form-message"
import { Button } from "@/components/ui/button"
import { useFormState } from "@/hooks/use-form-state"
import type { FormAction } from "@/lib/form"

const FIELD_ORDER = ["total"] as const

export function PurchaseTotalForm({
  id,
  // Already formatted for editing — "12,34", not "12,34 €" — because this is a
  // field and not a reading.
  total,
  action,
}: {
  id: string
  total: string
  action: FormAction
}) {
  const { state, formAction, isPending, attempt, errorOf, fieldProps } =
    useFormState(action, FIELD_ORDER, { total })

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />

      <div key={attempt}>
        <TextField
          {...fieldProps("total")}
          label="Quanto hai pagato"
          error={errorOf("total")}
          description="Svuota il campo per togliere l’importo."
          // Text and not number: a number input refuses a comma in some locales
          // and silently empties itself, and the parsing this field needs is
          // already in EuroCentsSchema.
          type="text"
          inputMode="decimal"
          placeholder="12,34"
          autoComplete="off"
        />
      </div>

      <FormMessage>{state.message}</FormMessage>

      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Salvo…" : "Salva l’importo"}
      </Button>
    </form>
  )
}
