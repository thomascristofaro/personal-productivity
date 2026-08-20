"use client"

import { useState } from "react"

import { TextField } from "@/components/page/fields"
import { FormDrawer } from "@/components/page/form-drawer"
import { Button } from "@/components/ui/button"
import { useFormState } from "@/hooks/use-form-state"
import type { FormAction } from "@/lib/form"

const FIELD_ORDER = ["total"] as const

export function CompletePurchaseBar({
  weekStart,
  checkedCount,
  action,
}: {
  weekStart: string
  // Counted over the stored rows and not the merged lines: what moves into the
  // history is rows, and a part-ticked line contributes only its ticked half.
  checkedCount: number
  action: FormAction
}) {
  const [open, setOpen] = useState(false)
  const form = useFormState(action, FIELD_ORDER)

  // Rendered by the server from what is actually stored, so it trails an
  // optimistic tick by one round trip. That is the honest number: closing a
  // shop against a tick the server has not seen would leave the line behind.
  if (checkedCount === 0) return null

  return (
    <>
      {/* Fixed rather than sticky: the list scrolls behind it, and at the till
          the thumb is at the bottom of the phone. The inset keeps it clear of
          the home indicator once the app is installed to the home screen. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button className="w-full" onClick={() => setOpen(true)}>
          Spesa completata ({checkedCount})
        </Button>
      </div>

      {/* No separate "Salta": confirming with the field empty is skipping,
          and two buttons that both close the shop is one more decision at
          the till than the moment deserves. The description says so. */}
      <FormDrawer
        open={open}
        onOpenChange={setOpen}
        form={form}
        title="Spesa completata"
        description={
          checkedCount === 1
            ? "1 articolo passa nello storico e sparisce dalla lista."
            : `${checkedCount} articoli passano nello storico e spariscono dalla lista.`
        }
        submitLabel="Conferma"
        pendingLabel="Salvo…"
      >
        <input type="hidden" name="weekStart" value={weekStart} />
        <TextField
          {...form.fieldProps("total")}
          label="Quanto hai pagato"
          error={form.errorOf("total")}
          description="Puoi lasciarlo vuoto e metterlo dopo, dallo storico."
          // Text and not number: a number input refuses a comma in some
          // locales and silently empties itself, and the parsing this field
          // needs is already in EuroCentsSchema.
          type="text"
          inputMode="decimal"
          placeholder="12,34"
          autoComplete="off"
        />
      </FormDrawer>
    </>
  )
}
