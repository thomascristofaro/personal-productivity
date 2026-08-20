"use client"

import { mergeDescribedBy } from "@/components/page/described-by"
import { FormField } from "@/components/page/form-field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

// These components define `label`, `description` and `error` and nothing else.
// Everything else spreads onto the native control, so `min`, `step`, `rows`,
// `type`, `inputMode`, `placeholder` and `required` pass through as the DOM
// attributes they already are. Without that rule NumberField grows a `min` in
// week one and an `allowDecimals` in week two.
//
// `id` is required rather than inherited as optional: the label's `htmlFor` and
// the description's and error's ids are all built from it, so a field without
// one is a field nothing points at. Every call site spreads `fieldProps`, which
// always supplies it — this makes that a compile error instead of a convention.
type Ours = { id: string; label: string; description?: string; error?: string }

// `Array.isArray` narrows the positive branch fine, but leaves `readonly
// string[]` in the union on the negative branch — TypeScript cannot subtract a
// readonly array from the `any[]` the guard narrows to. A type predicate does
// what the inline check cannot.
function isStringList(
  options: readonly string[] | Record<string, string>
): options is readonly string[] {
  return Array.isArray(options)
}

export function TextField({
  label,
  description,
  error,
  ...control
}: React.ComponentProps<typeof Input> & Ours) {
  return (
    <FormField
      name={control.id}
      label={label}
      description={description}
      error={error}
    >
      <Input
        {...control}
        aria-describedby={mergeDescribedBy(
          control.id,
          description !== undefined,
          control["aria-describedby"]
        )}
      />
    </FormField>
  )
}

export function NumberField(props: React.ComponentProps<typeof Input> & Ours) {
  return <TextField type="number" inputMode="numeric" {...props} />
}

export function TextareaField({
  label,
  description,
  error,
  ...control
}: React.ComponentProps<typeof Textarea> & Ours) {
  return (
    <FormField
      name={control.id}
      label={label}
      description={description}
      error={error}
    >
      <Textarea
        {...control}
        aria-describedby={mergeDescribedBy(
          control.id,
          description !== undefined,
          control["aria-describedby"]
        )}
      />
    </FormField>
  )
}

export function SelectField({
  label,
  description,
  error,
  options,
  id,
  name,
  defaultValue,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
  ...rest
}: Ours & {
  name: string
  defaultValue?: string
  "aria-invalid"?: true
  "aria-describedby"?: string
  // A list when the value and the label are the same string — the aisles. A map
  // when they differ — INGREDIENT to "Ingrediente". Base UI's Select.Value
  // renders the raw value unless the root is given the map, which is why this
  // is one prop and not two.
  options: readonly string[] | Record<string, string>
  value?: string
  onValueChange?: (value: string | null) => void
}) {
  const isList = isStringList(options)
  const entries: [string, string][] = isList
    ? options.map((option) => [option, option])
    : Object.entries(options)
  const items = isList ? undefined : options

  return (
    <FormField name={id} label={label} description={description} error={error}>
      <Select name={name} defaultValue={defaultValue} items={items} {...rest}>
        <SelectTrigger
          id={id}
          aria-invalid={invalid}
          aria-describedby={mergeDescribedBy(
            id,
            description !== undefined,
            describedBy
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {entries.map(([value, optionLabel]) => (
            <SelectItem key={value} value={value}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  )
}
