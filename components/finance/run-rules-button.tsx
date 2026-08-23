"use client"

import { FormMessage } from "@/components/page/form-message"
import { Button } from "@/components/ui/button"
import { useFormState } from "@/hooks/use-form-state"
import type { FormAction } from "@/lib/form"

// No fields, so nothing to focus on a refusal.
const FIELD_ORDER: readonly string[] = []

// A button that reports. PageForm would render a FieldGroup around nothing,
// which is markup for a form this one does not have — but the message still
// goes through FormMessage, so a success and a refusal look the way they do
// everywhere else.
export function RunRulesButton({ action }: { action: FormAction }) {
  const form = useFormState(action, FIELD_ORDER)

  return (
    <form action={form.formAction} className="flex flex-col gap-2">
      <Button
        type="submit"
        variant="outline"
        disabled={form.isPending}
        className="self-start"
      >
        {form.isPending ? "Applico…" : "Applica le regole ai movimenti passati"}
      </Button>

      <FormMessage ok={form.state.ok}>{form.state.message}</FormMessage>
    </form>
  )
}
