"use client"

import { useState } from "react"

import type { IngredientOption } from "@/components/ingredients/ingredient-picker"
import {
  IngredientRows,
  type IngredientRowValue,
} from "@/components/ingredients/ingredient-rows"
import {
  NumberField,
  SelectField,
  TextareaField,
  TextField,
} from "@/components/page/fields"
import { PageForm } from "@/components/page/page-form"
import { TagPicker } from "@/components/recipes/tag-picker"
import { useFormState } from "@/hooks/use-form-state"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { COURSE_LABELS } from "@/lib/courses"
import type { FormAction } from "@/lib/form"

export type RecipeFormValues = {
  id?: string
  title: string
  course: string
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
  "course",
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
  const form = useFormState(action, FIELD_ORDER, {
    title: values.title,
    course: values.course,
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
    <PageForm
      form={form}
      cancelHref={values.id ? `/recipes/${values.id}` : "/recipes"}
      onInput={() => setDirty(true)}
    >
      {values.id === undefined ? null : (
        <input type="hidden" name="id" value={values.id} />
      )}

      {/* Notes are not editable in the UI for now, but the column and the
          value survive: without this the next save would blank them. */}
      <input
        type="hidden"
        name="notes"
        value={form.state.values.notes ?? values.notes}
      />

      <TextField
        key={form.fieldKey("title")}
        {...form.fieldProps("title")}
        label="Nome"
        error={form.errorOf("title")}
        // Not a field a password manager or an address autofill has any business
        // completing. Without it "Nome" gets offered a saved identity.
        autoComplete="off"
        required
      />

      <SelectField
        key={form.fieldKey("course")}
        {...form.fieldProps("course")}
        label="Tipo"
        error={form.errorOf("course")}
        description="Decide in quale slot del menù la ricetta si può mettere."
        options={COURSE_LABELS}
        placeholder="Scegli…"
      />

      {/* A fieldset rather than a Field: the rows are a group of controls,
          each already carrying its own label, not one labelled input. It
          carries no attempt key — remounting it is what threw the typed
          ingredients away on a refused save. */}
      <fieldset>
        <legend className="mb-2 text-xs font-medium">Ingredienti</legend>
        <IngredientRows
          options={options}
          units={units}
          defaultRows={values.ingredients}
          onCreateIngredient={onCreateIngredient}
        />
        {form.errorOf("ingredients") === undefined ? null : (
          <p role="alert" className="text-xs text-destructive">
            {form.errorOf("ingredients")}
          </p>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <NumberField
          key={form.fieldKey("servings")}
          {...form.fieldProps("servings")}
          label="Porzioni"
          error={form.errorOf("servings")}
          min={1}
          autoComplete="off"
        />
        <NumberField
          key={form.fieldKey("totalMinutes")}
          {...form.fieldProps("totalMinutes")}
          label="Minuti"
          error={form.errorOf("totalMinutes")}
          min={1}
          autoComplete="off"
        />
      </div>

      <TextareaField
        key={form.fieldKey("instructions")}
        {...form.fieldProps("instructions")}
        label="Preparazione"
        error={form.errorOf("instructions")}
        rows={14}
        autoComplete="off"
      />

      <fieldset>
        <legend className="mb-2 text-xs font-medium">Etichette</legend>
        <TagPicker suggestions={tagSuggestions} defaultTags={values.tags} />
        {form.errorOf("tags") === undefined ? null : (
          <p role="alert" className="text-xs text-destructive">
            {form.errorOf("tags")}
          </p>
        )}
      </fieldset>

      <TextField
        key={form.fieldKey("sourceUrl")}
        {...form.fieldProps("sourceUrl")}
        label="Fonte"
        error={form.errorOf("sourceUrl")}
        type="url"
        inputMode="url"
        spellCheck={false}
        autoComplete="off"
      />
    </PageForm>
  )
}
