"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export type TotalState = { message: string | null }

export type SaveTotalAction = (
  state: TotalState,
  formData: FormData
) => Promise<TotalState>

export const EMPTY_TOTAL_STATE: TotalState = { message: null }

export function PurchaseTotalForm({
  id,
  // Already formatted for editing — "12,34", not "12,34 €" — because this is a
  // field and not a reading.
  total,
  action,
}: {
  id: string
  total: string
  action: SaveTotalAction
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    EMPTY_TOTAL_STATE
  )

  // Remounts the field after every result, so React 19's form reset cannot
  // fight the value the server sent back. During render, not in an effect.
  const [seen, setSeen] = useState(state)
  const [attempt, setAttempt] = useState(0)

  if (seen !== state) {
    setSeen(state)
    setAttempt((count) => count + 1)
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />

      <Field key={attempt}>
        <FieldLabel htmlFor="total">Quanto hai pagato</FieldLabel>
        <Input
          id="total"
          name="total"
          type="text"
          inputMode="decimal"
          placeholder="12,34"
          defaultValue={total}
          autoComplete="off"
          aria-describedby="total-description"
        />
        <FieldDescription id="total-description">
          Svuota il campo per togliere l’importo.
        </FieldDescription>
      </Field>

      {state.message === null ? null : (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Salvo…" : "Salva l’importo"}
      </Button>
    </form>
  )
}
