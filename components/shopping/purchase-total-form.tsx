"use client"

import { TextField } from "@/components/page/fields"
import { PageForm } from "@/components/page/page-form"
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
  const form = useFormState(action, FIELD_ORDER, { total })

  return (
    <PageForm
      form={form}
      className="gap-3"
      // Its own footer: this form is edited in place on the page it belongs to,
      // so there is nowhere for an Annulla to go, and the submit sits back at
      // `outline` because it is one control on a page of readings, not the
      // point of the screen.
      actions={
        <Button type="submit" variant="outline" disabled={form.isPending}>
          {form.isPending ? "Salvo…" : "Salva l’importo"}
        </Button>
      }
    >
      <input type="hidden" name="id" value={id} />

      <TextField
        key={form.fieldKey("total")}
        {...form.fieldProps("total")}
        label="Quanto hai pagato"
        error={form.errorOf("total")}
        description="Svuota il campo per togliere l’importo."
        // Text and not number: a number input refuses a comma in some locales
        // and silently empties itself, and the parsing this field needs is
        // already in EuroCentsSchema.
        type="text"
        inputMode="decimal"
        placeholder="12,34"
        autoComplete="off"
      />
    </PageForm>
  )
}
