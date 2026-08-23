"use client"

import { SelectField, TextField } from "@/components/page/fields"
import { PageForm } from "@/components/page/page-form"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { useFormState } from "@/hooks/use-form-state"
import type { FormAction } from "@/lib/form"
import { FINANCE_PROVIDER_LABELS } from "@/lib/schemas/finance"

export type AccountFormValues = {
  // Absent when creating.
  id?: string
  name: string
  provider: string
  openingBalance: string
  openingBalanceAt: string
  shared: boolean
}

// DOM order, so the first invalid field takes focus. Module-level: a fresh
// array on every render would re-run the hook's focus effect.
const FIELD_ORDER = [
  "name",
  "provider",
  "openingBalance",
  "openingBalanceAt",
] as const

export function AccountForm({
  values,
  action,
}: {
  values: AccountFormValues
  action: FormAction
}) {
  const form = useFormState(action, FIELD_ORDER, {
    name: values.name,
    provider: values.provider,
    openingBalance: values.openingBalance,
    openingBalanceAt: values.openingBalanceAt,
  })

  return (
    <PageForm form={form} cancelHref="/finance/accounts">
      {values.id === undefined ? null : (
        <input type="hidden" name="id" value={values.id} />
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
        key={form.fieldKey("provider")}
        {...form.fieldProps("provider")}
        label="Servizio"
        error={form.errorOf("provider")}
        description="Decide come viene letto il file che caricherai."
        // The map and not a list: a Base UI Select whose values differ from its
        // labels renders the raw value, and this one would read REVOLUT.
        options={FINANCE_PROVIDER_LABELS}
      />

      <TextField
        key={form.fieldKey("openingBalance")}
        {...form.fieldProps("openingBalance", { described: true })}
        label="Saldo iniziale"
        error={form.errorOf("openingBalance")}
        description="Il saldo del conto a quella data. Da lì in poi lo calcola l’app."
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
      />

      <TextField
        key={form.fieldKey("openingBalanceAt")}
        {...form.fieldProps("openingBalanceAt", { described: true })}
        label="Alla data"
        error={form.errorOf("openingBalanceAt")}
        description="I movimenti precedenti restano nello storico ma non contano nel saldo."
        type="date"
        required
      />

      <Field orientation="horizontal">
        <Checkbox
          id="shared"
          name="shared"
          value="1"
          defaultChecked={values.shared}
        />
        <FieldLabel htmlFor="shared">Visibile anche all’altra persona</FieldLabel>
      </Field>
    </PageForm>
  )
}
