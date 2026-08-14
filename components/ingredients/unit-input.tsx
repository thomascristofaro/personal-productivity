"use client"

import { Input } from "@/components/ui/input"

// A plain input with a datalist rather than a combobox: the unit is free text
// first and a suggestion second, and a datalist keeps typing an unlisted unit
// the default behaviour instead of a fight with a picker.
export function UnitInput({
  name,
  value,
  onChange,
  listId,
  "aria-label": ariaLabel,
}: {
  name: string
  value: string
  onChange: (value: string) => void
  listId: string
  "aria-label": string
}) {
  return (
    <Input
      name={name}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      list={listId}
      aria-label={ariaLabel}
      placeholder="Unità"
      autoComplete="off"
      spellCheck={false}
    />
  )
}
