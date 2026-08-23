"use client"

import { TextareaField } from "@/components/page/fields"
import { PageForm } from "@/components/page/page-form"
import { Button } from "@/components/ui/button"
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
      className="gap-3"
      // The same footer as PurchaseTotalForm, which is the same situation: a
      // form edited in place on a page of readings, so there is nowhere for an
      // Annulla to go and the submit sits back at `outline`.
      //
      // The confirmation is not written here. PageForm renders `state.message`,
      // and since FormMessage learned the difference between a success and a
      // refusal, "Nota salvata." arrives on its own and in the right colour.
      actions={
        <Button type="submit" variant="outline" disabled={form.isPending}>
          {form.isPending ? "Salvo…" : "Salva la nota"}
        </Button>
      }
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
    </PageForm>
  )
}
