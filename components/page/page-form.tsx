"use client"

import { FormActions } from "@/components/page/form-actions"
import { FormMessage } from "@/components/page/form-message"
import { FieldGroup } from "@/components/ui/field"
import type { useFormState } from "@/hooks/use-form-state"
import { cn } from "@/lib/utils"

type Form = ReturnType<typeof useFormState>

// The page twin of FormDrawer: the `<form>`, the field group, the message and
// the footer, so a form component is a hook call and a list of fields.
//
// It does not own the page. `PageHeader` stays outside, in the server component
// above — a heading is not form content, and putting it inside the `<form>`
// would be wrong markup for no gain.
//
// **It does not key the field group, and FormDrawer does.** The difference is
// not arbitrary: a drawer closes on success, so remounting everything it holds
// is right and is what empties its pickers. A page form stays put — the only
// attempt it ever renders is a refusal, and a refusal must preserve what was
// typed. Fields whose `defaultValue` moved key themselves with
// `form.fieldKey(name)`.
export function PageForm({
  form,
  cancelHref,
  onInput,
  actions,
  className,
  children,
}: {
  form: Form
  // Absent on a form with nowhere to go back to — the till form is edited in
  // place on the page it belongs to.
  cancelHref?: string
  // For a guard the shell cannot see: the recipe form arms its unsaved-changes
  // warning on real input events, not on every click.
  onInput?: () => void
  // Replaces the footer entirely, for a submit that is not the standard pair.
  actions?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <form
      action={form.formAction}
      onInput={onInput}
      className={cn("flex flex-col gap-6", className)}
    >
      <FieldGroup>{children}</FieldGroup>

      <FormMessage>{form.state.message}</FormMessage>

      {actions ?? (
        <FormActions cancelHref={cancelHref} isPending={form.isPending} />
      )}
    </form>
  )
}
