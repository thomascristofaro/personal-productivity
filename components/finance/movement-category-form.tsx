"use client"

import { useState } from "react"

import { SelectField, TextField } from "@/components/page/fields"
import { PageForm } from "@/components/page/page-form"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { useFormState } from "@/hooks/use-form-state"
import type { FormAction } from "@/lib/form"

// Module-level: a fresh array on every render would re-run the hook's focus
// effect.
const FIELD_ORDER = ["categoryId", "pattern"] as const

export function MovementCategoryForm({
  movementId,
  categoryId,
  categories,
  suggestedPattern,
  action,
}: {
  movementId: string
  categoryId: string
  // Id to name. A Base UI Select whose values differ from its labels renders
  // the raw value without the map, and this one would show a cuid.
  categories: Record<string, string>
  suggestedPattern: string
  action: FormAction
}) {
  const form = useFormState(action, FIELD_ORDER, {
    categoryId,
    pattern: suggestedPattern,
  })

  // Ticked by default on a movement nobody has classified: that is the case the
  // rule exists for. On one already categorised, changing the category is more
  // often a correction of this row alone.
  const [remember, setRemember] = useState(categoryId === "")

  return (
    <PageForm
      form={form}
      className="gap-3"
      // The same footer as PurchaseTotalForm and MovementNoteForm: a form in
      // the middle of a page of readings, with nowhere for an Annulla to go.
      //
      // The confirmation is not written here. PageForm renders `state.message`,
      // and FormMessage knows a success from a refusal.
      actions={
        <Button type="submit" variant="outline" disabled={form.isPending}>
          {form.isPending ? "Salvo…" : "Salva la categoria"}
        </Button>
      }
    >
      <input type="hidden" name="id" value={movementId} />

      <SelectField
        // The incoming value is part of the key, not only the attempt counter:
        // a `defaultValue` is read at mount, and this one also changes without
        // a submit — unlinking a transfer revalidates the page and clears the
        // category. Without it the select goes on showing «Trasferimento» on a
        // movement that no longer has one.
        key={`${form.fieldKey("categoryId")}-${categoryId}`}
        {...form.fieldProps("categoryId")}
        label="Categoria"
        error={form.errorOf("categoryId")}
        options={categories}
      />

      <Field orientation="horizontal">
        <Checkbox
          id="remember"
          name="remember"
          value="1"
          checked={remember}
          onCheckedChange={(next) => setRemember(next === true)}
        />
        <FieldLabel htmlFor="remember">Ricorda questa scelta</FieldLabel>
      </Field>

      {remember ? (
        <>
          <TextField
            key={form.fieldKey("pattern")}
            {...form.fieldProps("pattern", { described: true })}
            label="Quando la descrizione contiene"
            error={form.errorOf("pattern")}
            description="Suggerito dalla descrizione. Accorcialo a quello che riconosci."
            autoComplete="off"
          />

          <Field orientation="horizontal">
            <Checkbox id="backfill" name="backfill" value="1" />
            <FieldLabel htmlFor="backfill">
              Applica anche ai movimenti passati
            </FieldLabel>
          </Field>
        </>
      ) : null}
    </PageForm>
  )
}
