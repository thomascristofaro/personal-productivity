"use client"

import { useEffect, useRef } from "react"

import { FormMessage } from "@/components/page/form-message"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { FieldGroup } from "@/components/ui/field"
import type { useFormState } from "@/hooks/use-form-state"

type Form = ReturnType<typeof useFormState>

// Always controlled, and it does not own the hook: one rule for the whole
// layer, and the three triggers in this app — a floating button, a fixed bar,
// and a parent holding the open slot — stay three different things, which is
// what they are.
export function FormDrawer({
  open,
  onOpenChange,
  form,
  title,
  description,
  submitLabel,
  pendingLabel,
  submitDisabled = false,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: Form
  title: string
  description?: string
  submitLabel: string
  pendingLabel: string
  // For a guard the drawer cannot see — the add-item drawer keeps the name in
  // its own state and refuses to submit an empty one. Not a mode: it is the
  // button's own `disabled`, reached from outside.
  submitDisabled?: boolean
  children: React.ReactNode
}) {
  // Always controlled means `onOpenChange` belongs to the parent, not to this
  // component — calling it during this component's own render would update a
  // different component mid-render, which React forbids. Hence an effect,
  // guarded by `attempt` so a re-render that leaves it unchanged (a parent
  // handing in a new `onOpenChange` identity, for instance) does not close
  // the drawer a second time.
  const handledAttempt = useRef(form.attempt)

  useEffect(() => {
    if (form.attempt === handledAttempt.current) return
    handledAttempt.current = form.attempt
    if (form.state.ok) onOpenChange(false)
  }, [form.attempt, form.state.ok, onOpenChange])

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          {description === undefined ? null : (
            <DrawerDescription>{description}</DrawerDescription>
          )}
        </DrawerHeader>

        <form action={form.formAction} className="flex flex-col gap-6 px-4">
          <FieldGroup key={form.attempt}>{children}</FieldGroup>

          <FormMessage>{form.state.message}</FormMessage>

          <DrawerFooter className="px-0">
            <Button type="submit" disabled={form.isPending || submitDisabled}>
              {form.isPending ? pendingLabel : submitLabel}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
