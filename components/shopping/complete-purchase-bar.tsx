"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export type CompleteState = { ok: boolean; message: string | null }

export type CompleteAction = (
  state: CompleteState,
  formData: FormData
) => Promise<CompleteState>

export const EMPTY_COMPLETE_STATE: CompleteState = { ok: false, message: null }

export function CompletePurchaseBar({
  weekStart,
  checkedCount,
  action,
}: {
  weekStart: string
  // Counted over the stored rows and not the merged lines: what moves into the
  // history is rows, and a part-ticked line contributes only its ticked half.
  checkedCount: number
  action: CompleteAction
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(
    action,
    EMPTY_COMPLETE_STATE
  )

  // Adjusting state during render rather than in an effect — the same reasoning
  // as components/shopping/add-item-drawer.tsx, and the same lint rule.
  const [seen, setSeen] = useState(state)
  const [attempt, setAttempt] = useState(0)

  if (seen !== state) {
    setSeen(state)
    setAttempt((count) => count + 1)
    if (state.ok) setOpen(false)
  }

  // Rendered by the server from what is actually stored, so it trails an
  // optimistic tick by one round trip. That is the honest number: closing a
  // shop against a tick the server has not seen would leave the line behind.
  if (checkedCount === 0) return null

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      {/* Fixed rather than sticky: the list scrolls behind it, and at the till
          the thumb is at the bottom of the phone. The inset keeps it clear of
          the home indicator once the app is installed to the home screen. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button className="w-full" onClick={() => setOpen(true)}>
          Spesa completata ({checkedCount})
        </Button>
      </div>

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Spesa completata</DrawerTitle>
          <DrawerDescription>
            {checkedCount === 1
              ? "1 articolo passa nello storico e sparisce dalla lista."
              : `${checkedCount} articoli passano nello storico e spariscono dalla lista.`}
          </DrawerDescription>
        </DrawerHeader>

        <form action={formAction} className="flex flex-col gap-6 px-4">
          <input type="hidden" name="weekStart" value={weekStart} />

          <Field key={attempt}>
            <FieldLabel htmlFor="total">Quanto hai pagato</FieldLabel>
            {/* Text and not number: a number input refuses a comma in some
                locales and silently empties itself, and the parsing this field
                needs is already in EuroCentsSchema. */}
            <Input
              id="total"
              name="total"
              type="text"
              inputMode="decimal"
              placeholder="12,34"
              autoComplete="off"
              aria-describedby="total-description"
            />
            <FieldDescription id="total-description">
              Puoi lasciarlo vuoto e metterlo dopo, dallo storico.
            </FieldDescription>
          </Field>

          {state.message === null ? null : (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}

          {/* No separate "Salta": confirming with the field empty is skipping,
              and two buttons that both close the shop is one more decision at
              the till than the moment deserves. The description says so. */}
          <DrawerFooter className="px-0">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvo…" : "Conferma"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
