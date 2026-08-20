"use client"

import { useState } from "react"

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
  // Adjusting state during render rather than in an effect: React re-runs the
  // component before committing, so the drawer never paints open after a
  // successful save. An effect here would be a cascading render, which is what
  // react-hooks/set-state-in-effect objects to.
  const [seen, setSeen] = useState(form.attempt)

  if (seen !== form.attempt) {
    setSeen(form.attempt)
    if (form.state.ok) onOpenChange(false)
  }

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
