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

export type RecipeOption = { id: string; title: string }

// Unlike the ingredient picker, this one carries objects rather than plain
// strings: two recipes may share a title, so the title cannot identify the row.
// That is what makes itemToStringLabel and isItemEqualToValue necessary here.
export function RecipePicker({
  id,
  recipes,
  value,
  onSelect,
}: {
  id: string
  recipes: RecipeOption[]
  value: RecipeOption | null
  onSelect: (recipe: RecipeOption) => void
}) {
  const [query, setQuery] = useState("")

  return (
    <Combobox
      // Off: a recipe is not a field a password manager has any business
      // completing.
      autoComplete="off"
      items={recipes}
      itemToStringLabel={(recipe: RecipeOption) => recipe.title}
      isItemEqualToValue={(a: RecipeOption, b: RecipeOption) => a.id === b.id}
      value={value}
      onValueChange={(recipe: RecipeOption | null) => {
        if (recipe !== null) onSelect(recipe)
      }}
      inputValue={query}
      onInputValueChange={setQuery}
    >
      <ComboboxInput id={id} placeholder="Cerca una ricetta" />
      <ComboboxContent>
        <ComboboxEmpty>Nessuna ricetta con questo nome.</ComboboxEmpty>
        <ComboboxList>
          {(recipe: RecipeOption) => (
            <ComboboxItem key={recipe.id} value={recipe}>
              {recipe.title}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
