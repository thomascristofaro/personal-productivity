"use client"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { matchesQuery } from "@/lib/search"

export type RecipeOption = { id: string; title: string }

// Unlike the ingredient picker, this one carries objects rather than plain
// strings: two recipes may share a title, so the title cannot identify the row.
// That is what makes itemToStringLabel and isItemEqualToValue necessary here.
export function RecipePicker({
  id,
  recipes,
  value,
  onSelect,
  "aria-describedby": describedBy,
}: {
  id: string
  recipes: RecipeOption[]
  value: RecipeOption | null
  onSelect: (recipe: RecipeOption | null) => void
  "aria-describedby"?: string
}) {
  return (
    <Combobox
      // Off: a recipe is not a field a password manager has any business
      // completing.
      autoComplete="off"
      // In place of Base UI's own, which matches the query as a single string:
      // «insalata zucchine» would never find «Insalata con zucchine».
      filter={(recipe: RecipeOption, query: string) =>
        matchesQuery(recipe.title, query)
      }
      items={recipes}
      itemToStringLabel={(recipe: RecipeOption) => recipe.title}
      isItemEqualToValue={(a: RecipeOption, b: RecipeOption) => a.id === b.id}
      value={value}
      // The null is no longer discarded: clearing the field is how a slot holding a
      // recipe is emptied, now that «Svuota» is gone.
      onValueChange={onSelect}
      // The input is left uncontrolled on purpose. Driving it from a query
      // state that starts empty is what made a slot holding a recipe reopen
      // with a blank field: Base UI derives the text from `value` itself.
    >
      <ComboboxInput
        id={id}
        aria-describedby={describedBy}
        placeholder="Cerca una ricetta…"
        showClear
      />
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
