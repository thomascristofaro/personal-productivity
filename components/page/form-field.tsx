import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"

// The shell every field wears: the typed four in `fields.tsx` render through
// this, and a call site reaches for it directly when the control is one they
// cannot carry — a picker, a datalist, a checkbox. Doing so is normal, not a
// failure.
//
// `name` must be the control's own id: it is the label's `htmlFor` and the base
// of the description's and the error's ids. Because the call site writes the
// control, the call site also points it at the description — with
// `{ described: true }` on fieldProps when it is spreading them. This component
// cannot reach into its children to do it.
export function FormField({
  name,
  label,
  description,
  error,
  children,
}: {
  name: string
  label: string
  description?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <Field data-invalid={error ? "true" : undefined}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      {children}
      {description === undefined ? null : (
        <FieldDescription id={`${name}-description`}>
          {description}
        </FieldDescription>
      )}
      <FieldError id={`${name}-error`}>{error}</FieldError>
    </Field>
  )
}
