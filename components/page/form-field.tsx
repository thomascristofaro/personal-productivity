import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"

// For controls the typed four cannot carry: a picker, a datalist, a checkbox.
// Reaching for this is normal, not a failure. The call site writes the control,
// so it also passes `{ described: true }` to fieldProps when there is a
// description — this component cannot reach into its children to do it.
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
