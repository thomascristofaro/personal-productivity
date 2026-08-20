"use client"

import { SelectField, TextField } from "@/components/page/fields"
import { FormActions } from "@/components/page/form-actions"
import { FormField } from "@/components/page/form-field"
import { FormMessage } from "@/components/page/form-message"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useFormState } from "@/hooks/use-form-state"
import type { FormAction } from "@/lib/form"

export type CatalogFormValues = {
  // Absent when creating. Carried as a hidden field so a rename knows which row
  // to update: the name is the primary key, so the new value cannot identify
  // the old row.
  originalName?: string
  name: string
  kind: string
  defaultUnit: string
  aisle: string
}

// DOM order, so the first invalid field takes focus. Module-level: a fresh
// array on every render would re-run the hook's focus effect.
const FIELD_ORDER = ["name", "kind", "defaultUnit", "aisle"] as const

// The stored values are English because they are database values; the labels
// are Italian because they are what the user reads.
const KIND_LABELS: Record<string, string> = {
  INGREDIENT: "Ingrediente",
  PRODUCT: "Prodotto",
}

export function CatalogForm({
  values,
  action,
  aisles,
  units,
}: {
  values: CatalogFormValues
  action: FormAction
  aisles: readonly string[]
  units: string[]
}) {
  // An explicit object, not `values`: CatalogFormValues has an optional
  // `originalName`, which is not assignable to Record<string, string>.
  const { state, formAction, isPending, attempt, errorOf, fieldProps } =
    useFormState(action, FIELD_ORDER, {
      name: values.name,
      kind: values.kind,
      defaultUnit: values.defaultUnit,
      aisle: values.aisle,
    })

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {values.originalName === undefined ? null : (
        <input type="hidden" name="originalName" value={values.originalName} />
      )}

      <FieldGroup key={attempt}>
        <TextField
          {...fieldProps("name")}
          label="Nome"
          error={errorOf("name")}
          autoComplete="off"
          required
        />

        <SelectField
          {...fieldProps("kind")}
          label="Tipo"
          error={errorOf("kind")}
          description="Solo un ingrediente si può scegliere dentro una ricetta."
          options={KIND_LABELS}
        />

        <FormField
          name="defaultUnit"
          label="Unità preferita"
          error={errorOf("defaultUnit")}
          description="Riempie la riga della ricetta. Lascia vuoto se si conta a pezzi."
        >
          <Input
            {...fieldProps("defaultUnit", { described: true })}
            list="unit-suggestions"
            autoComplete="off"
            spellCheck={false}
          />
          <datalist id="unit-suggestions">
            {units.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
        </FormField>

        <SelectField
          {...fieldProps("aisle")}
          label="Reparto"
          error={errorOf("aisle")}
          description="Decide dove finisce nella lista della spesa."
          options={aisles}
        />
      </FieldGroup>

      <FormMessage>{state.message}</FormMessage>
      <FormActions cancelHref="/catalogo" isPending={isPending} />
    </form>
  )
}
