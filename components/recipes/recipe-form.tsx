"use client"

import { useState } from "react"

import type { IngredientOption } from "@/components/ingredients/ingredient-picker"
import {
  IngredientRows,
  type IngredientRowValue,
} from "@/components/ingredients/ingredient-rows"
import { NumberField, TextareaField, TextField } from "@/components/page/fields"
import { FormActions } from "@/components/page/form-actions"
import { FormMessage } from "@/components/page/form-message"
import { TagPicker } from "@/components/recipes/tag-picker"
import { FieldGroup } from "@/components/ui/field"
import { useFormState } from "@/hooks/use-form-state"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import type { FormAction } from "@/lib/form"

export type RecipeFormValues = {
  id?: string
  title: string
  sourceUrl: string
  servings: string
  totalMinutes: string
  instructions: string
  notes: string
  tags: string[]
  ingredients: IngredientRowValue[]
}

// DOM order of the flat fields, so the first invalid one can take focus after a
// failed submit — the field ids double as this list. Ingredients and tags are
// absent on purpose: neither has a single element carrying that id.
const FIELD_ORDER = [
  "title",
  "servings",
  "totalMinutes",
  "instructions",
  "sourceUrl",
] as const

export function RecipeForm({
  values,
  action,
  options,
  units,
  tagSuggestions,
  onCreateIngredient,
}: {
  values: RecipeFormValues
  action: FormAction
  options: IngredientOption[]
  units: string[]
  tagSuggestions: string[]
  onCreateIngredient: (name: string) => Promise<IngredientOption | null>
}) {
  const { state, formAction, isPending, attempt, errorOf, fieldProps } =
    useFormState(action, FIELD_ORDER, {
      title: values.title,
      sourceUrl: values.sourceUrl,
      servings: values.servings,
      totalMinutes: values.totalMinutes,
      instructions: values.instructions,
      notes: values.notes,
    })

  // Armed by real input events, so a change made only by clicking — pulling a
  // row out, say — does not arm it. A guard that fires when nothing was typed
  // is worse than one that occasionally stays quiet, and this is the longest
  // form in the app: it is the one where retyping actually costs something.
  const [dirty, setDirty] = useState(false)
  useUnsavedChanges(dirty)

  return (
    <form
      action={formAction}
      onInput={() => setDirty(true)}
      className="flex flex-col gap-6"
    >
      {values.id === undefined ? null : (
        <input type="hidden" name="id" value={values.id} />
      )}

      {/* Notes are not editable in the UI for now, but the column and the
          value survive: without this the next save would blank them. */}
      <input
        type="hidden"
        name="notes"
        value={state.values.notes ?? values.notes}
      />

      {/* The attempt key sits on each flat field rather than on the group. Its
          job is to remount an uncontrolled input whose defaultValue changed
          after mount; the two fieldsets below hold components with their own
          state, and remounting those threw away the ingredients and tags the
          user had entered whenever a save was refused. The field name is part
          of each key because siblings may not share one. */}
      <FieldGroup>
        <TextField
          key={`title-${attempt}`}
          {...fieldProps("title")}
          label="Nome"
          error={errorOf("title")}
          // Not a field a password manager or an address autofill has any business
          // completing. Without it "Nome" gets offered a saved identity.
          autoComplete="off"
          required
        />

        {/* A fieldset rather than a Field: the rows are a group of controls,
            each already carrying its own label, not one labelled input. */}
        <fieldset>
          <legend className="mb-2 text-xs font-medium">Ingredienti</legend>
          <IngredientRows
            options={options}
            units={units}
            defaultRows={values.ingredients}
            onCreateIngredient={onCreateIngredient}
          />
          {errorOf("ingredients") === undefined ? null : (
            <p role="alert" className="text-xs text-destructive">
              {errorOf("ingredients")}
            </p>
          )}
        </fieldset>

        <div className="grid grid-cols-2 gap-4">
          <NumberField
            key={`servings-${attempt}`}
            {...fieldProps("servings")}
            label="Porzioni"
            error={errorOf("servings")}
            min={1}
            autoComplete="off"
          />
          <NumberField
            key={`totalMinutes-${attempt}`}
            {...fieldProps("totalMinutes")}
            label="Minuti"
            error={errorOf("totalMinutes")}
            min={1}
            autoComplete="off"
          />
        </div>

        <TextareaField
          key={`instructions-${attempt}`}
          {...fieldProps("instructions")}
          label="Preparazione"
          error={errorOf("instructions")}
          rows={14}
          autoComplete="off"
        />

        <fieldset>
          <legend className="mb-2 text-xs font-medium">Etichette</legend>
          <TagPicker suggestions={tagSuggestions} defaultTags={values.tags} />
          {errorOf("tags") === undefined ? null : (
            <p role="alert" className="text-xs text-destructive">
              {errorOf("tags")}
            </p>
          )}
        </fieldset>

        <TextField
          key={`sourceUrl-${attempt}`}
          {...fieldProps("sourceUrl")}
          label="Fonte"
          error={errorOf("sourceUrl")}
          type="url"
          inputMode="url"
          spellCheck={false}
          autoComplete="off"
        />
      </FieldGroup>

      <FormMessage>{state.message}</FormMessage>
      <FormActions
        cancelHref={values.id ? `/recipes/${values.id}` : "/recipes"}
        isPending={isPending}
      />
    </form>
  )
}
