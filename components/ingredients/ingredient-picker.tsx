"use client"

import { useState } from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

export type IngredientOption = {
  name: string
  defaultUnit: string | null
}

// The combobox deals in plain names rather than option objects: the name is the
// catalogue's primary key, so there is nothing else to carry, and Base UI then
// needs neither itemToStringLabel nor isItemEqualToValue.
export function IngredientPicker({
  id,
  names,
  value,
  onSelect,
  onCreate,
  "aria-label": ariaLabel,
}: {
  // Optional: the rows inside a recipe name each picker with aria-label alone,
  // because there is no visible label to point at. A standalone field has one,
  // and that label needs something to be clickable against.
  id?: string
  names: string[]
  value: string | null
  onSelect: (name: string) => void
  onCreate: (name: string) => void
  "aria-label": string
}) {
  // Seeded from the value, not empty: this input is controlled, so starting it
  // blank would hide the name of an ingredient the row already holds. The
  // query has to exist all the same — "Crea «…»" is decided from it.
  const [query, setQuery] = useState(value ?? "")
  const trimmed = query.trim()
  const isNew =
    trimmed.length > 0 &&
    !names.some((name) => name.toLowerCase() === trimmed.toLowerCase())

  return (
    <Combobox
      // Off: a recipe ingredient is not a field a password
      // manager or an address autofill has any business completing.
      autoComplete="off"
      items={names}
      value={value}
      onValueChange={(name) => {
        if (name !== null) onSelect(name)
      }}
      inputValue={query}
      onInputValueChange={setQuery}
    >
      <ComboboxInput
        id={id}
        aria-label={ariaLabel}
        placeholder="Cerca un ingrediente…"
      />
      <ComboboxContent>
        <ComboboxEmpty>
          {isNew ? (
            <button
              type="button"
              className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
              onClick={() => onCreate(trimmed)}
            >
              Crea «{trimmed}»
            </button>
          ) : (
            "Nessun ingrediente."
          )}
        </ComboboxEmpty>
        <ComboboxList>
          {(name: string) => (
            <ComboboxItem key={name} value={name}>
              {name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
