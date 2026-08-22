"use client"

import { TextareaField } from "@/components/page/fields"
import { FormActions } from "@/components/page/form-actions"
import { PageForm } from "@/components/page/page-form"
import { useFormState } from "@/hooks/use-form-state"
import type { FormAction } from "@/lib/form"

// Module-level: a fresh array on every render would re-run the hook's focus
// effect.
const FIELD_ORDER = ["note"] as const

export function MovementNoteForm({
  movementId,
  note,
  action,
}: {
  movementId: string
  note: string
  action: FormAction
}) {
  const form = useFormState(action, FIELD_ORDER, { note })

  return (
    <PageForm
      form={form}
      // No cancelHref: the form is edited in place on the page it belongs to,
      // and a link cancelling to the page you are already on says nothing.
      actions={<FormActions isPending={form.isPending} submitLabel="Salva la nota" />}
    >
      <input type="hidden" name="id" value={movementId} />

      <TextareaField
        key={form.fieldKey("note")}
        {...form.fieldProps("note", { described: true })}
        label="Nota"
        error={form.errorOf("note")}
        description="Quello che il file non dice: a chi era il rimborso, perché quell’importo."
        rows={3}
      />

      {form.state.ok && form.state.message !== null ? (
        // The success is announced rather than shown as a toast: this form does
        // not close, so there is a place on screen for the answer to live.
        <p role="status" className="text-sm text-muted-foreground">
          {form.state.message}
        </p>
      ) : null}
    </PageForm>
  )
}
