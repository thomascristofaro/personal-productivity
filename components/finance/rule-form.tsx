"use client"

import { SelectField, TextField } from "@/components/page/fields"
import { PageForm } from "@/components/page/page-form"
import { useFormState } from "@/hooks/use-form-state"
import type { FormAction } from "@/lib/form"
import { RULE_KIND_LABELS } from "@/lib/schemas/finance"

// Module-level: a fresh array on every render would re-run the hook's focus
// effect.
const FIELD_ORDER = ["kind", "pattern", "categoryId", "accountId"] as const

// The empty string is what "every account" posts, and RuleInputSchema turns it
// into null.
const EVERY_ACCOUNT = ""

export function RuleForm({
  categories,
  accounts,
  action,
}: {
  categories: Record<string, string>
  accounts: Record<string, string>
  action: FormAction
}) {
  const form = useFormState(action, FIELD_ORDER, {
    kind: "DESCRIPTION_CONTAINS",
    pattern: "",
    accountId: EVERY_ACCOUNT,
  })

  return (
    <PageForm form={form}>
      <SelectField
        key={form.fieldKey("kind")}
        {...form.fieldProps("kind")}
        label="Regola"
        error={form.errorOf("kind")}
        options={RULE_KIND_LABELS}
      />

      <TextField
        key={form.fieldKey("pattern")}
        {...form.fieldProps("pattern")}
        label="Testo"
        error={form.errorOf("pattern")}
        autoComplete="off"
        required
      />

      <SelectField
        key={form.fieldKey("categoryId")}
        {...form.fieldProps("categoryId")}
        label="Categoria"
        error={form.errorOf("categoryId")}
        options={categories}
      />

      <SelectField
        key={form.fieldKey("accountId")}
        {...form.fieldProps("accountId")}
        label="Conto"
        error={form.errorOf("accountId")}
        description="Una regola vale per tutti i conti, salvo che ne scegli uno."
        options={{ [EVERY_ACCOUNT]: "Tutti i conti", ...accounts }}
      />
    </PageForm>
  )
}
