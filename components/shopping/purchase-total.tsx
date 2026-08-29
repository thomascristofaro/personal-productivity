"use client"

import { Check, Loader2, Pencil, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { TextField } from "@/components/page/fields"
import { PageForm } from "@/components/page/page-form"
import { Button } from "@/components/ui/button"
import { useFormState } from "@/hooks/use-form-state"
import type { FormAction } from "@/lib/form"
import { formatEuro } from "@/lib/money"

const FIELD_ORDER = ["total"] as const

// For the field, not for reading: "12,34" and not "12,34 €".
const forEditing = (cents: number | null) =>
  cents === null ? "" : (cents / 100).toFixed(2).replace(".", ",")

/**
 * The amount paid: a reading with a pencil, and a field only once asked for.
 *
 * A form that is always on screen makes a page of readings look like a page of
 * work. The value is the reading; editing it is the exception.
 */
export function PurchaseTotal({
  id,
  totalCents,
  action,
}: {
  id: string
  totalCents: number | null
  action: FormAction
}) {
  const [editing, setEditing] = useState(false)
  const form = useFormState(action, FIELD_ORDER, {
    total: forEditing(totalCents),
  })
  const input = useRef<HTMLInputElement>(null)

  // A successful save is the only way out of the field other than the cross.
  // Same shape as AddItemDrawer: `attempt` changes once per completed attempt,
  // and adjusting this component's own state during render is legal.
  const [seen, setSeen] = useState(form.attempt)
  if (seen !== form.attempt) {
    setSeen(form.attempt)
    if (form.state.ok) setEditing(false)
  }

  // The pencil is the request to type, so land in the field with what is there
  // already selected — the next keystroke replaces the amount rather than
  // appending to it.
  useEffect(() => {
    if (!editing) return
    input.current?.focus()
    input.current?.select()
  }, [editing])

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground">Totale</span>
        <div className="flex items-center gap-1">
          <span
            className={
              totalCents === null
                ? "text-sm text-muted-foreground"
                : "text-sm font-medium tabular-nums"
            }
          >
            {totalCents === null
              ? "Non ancora inserito"
              : formatEuro(totalCents)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Modifica l’importo"
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden="true" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <PageForm
      form={form}
      className="gap-3"
      // Its own footer: two icons and no Annulla link, because this form is
      // edited in place on the page it belongs to and there is nowhere to go
      // back to.
      actions={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Annulla"
            disabled={form.isPending}
            onClick={() => setEditing(false)}
          >
            <X aria-hidden="true" />
          </Button>
          <Button
            type="submit"
            variant="outline"
            size="icon"
            aria-label="Salva l’importo"
            disabled={form.isPending}
          >
            {/* An icon has no "Salvo…" to fall back on, so the icon itself is
                the pending state. */}
            {form.isPending ? (
              <Loader2
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Check aria-hidden="true" />
            )}
          </Button>
        </div>
      }
    >
      <input type="hidden" name="id" value={id} />

      <TextField
        key={form.fieldKey("total")}
        {...form.fieldProps("total")}
        ref={input}
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
