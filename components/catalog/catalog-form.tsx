"use client"

import { SelectField, TextField } from "@/components/page/fields"
import { FormField } from "@/components/page/form-field"
import { PageForm } from "@/components/page/page-form"
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
  const form = useFormState(action, FIELD_ORDER, {
    name: values.name,
    kind: values.kind,
    defaultUnit: values.defaultUnit,
    aisle: values.aisle,
  })

  return (
    <PageForm form={form} cancelHref="/catalogo">
      {values.originalName === undefined ? null : (
        <input type="hidden" name="originalName" value={values.originalName} />
      )}

      <TextField
        key={form.fieldKey("name")}
        {...form.fieldProps("name")}
        label="Nome"
        error={form.errorOf("name")}
        autoComplete="off"
        required
      />

      <SelectField
        key={form.fieldKey("kind")}
        {...form.fieldProps("kind")}
        label="Tipo"
        error={form.errorOf("kind")}
        description="Solo un ingrediente si può scegliere dentro una ricetta."
        options={KIND_LABELS}
      />

      <FormField
        name="defaultUnit"
        label="Unità preferita"
        error={form.errorOf("defaultUnit")}
        description="Riempie la riga della ricetta. Lascia vuoto se si conta a pezzi."
      >
        <Input
          key={form.fieldKey("defaultUnit")}
          {...form.fieldProps("defaultUnit", { described: true })}
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
        key={form.fieldKey("aisle")}
        {...form.fieldProps("aisle")}
        label="Reparto"
        error={form.errorOf("aisle")}
        description="Decide dove finisce nella lista della spesa."
        options={aisles}
      />
    </PageForm>
  )
}
