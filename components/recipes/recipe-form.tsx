"use client"

import Link from "next/link"
import { useActionState, useEffect } from "react"

import type { IngredientOption } from "@/components/ingredients/ingredient-picker"
import {
  IngredientRows,
  type IngredientRowValue,
} from "@/components/ingredients/ingredient-rows"
import {
  EMPTY_FORM_STATE,
  type SaveRecipeAction,
} from "@/components/recipes/recipe-form-state"
import { TagPicker } from "@/components/recipes/tag-picker"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

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
const FIELD_ORDER: (keyof RecipeFormValues)[] = [
  "title",
  "servings",
  "totalMinutes",
  "instructions",
  "sourceUrl",
]

export function RecipeForm({
  values,
  action,
  options,
  units,
  tagSuggestions,
  onCreateIngredient,
}: {
  values: RecipeFormValues
  action: SaveRecipeAction
  options: IngredientOption[]
  units: string[]
  tagSuggestions: string[]
  onCreateIngredient: (name: string) => Promise<IngredientOption | null>
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    EMPTY_FORM_STATE
  )

  const errorOf = (field: keyof RecipeFormValues) => state.errors[field]?.[0]
  const invalid = (field: keyof RecipeFormValues) =>
    errorOf(field) ? "true" : undefined
  // React 19 resets the form to its `defaultValue`s before an action-driven
  // submit runs, unconditionally. Echoing the submitted value back through
  // `state.values` and reading it here first means a failed save re-renders
  // the form with what the user typed, not the original prop.
  // Flat fields only — ingredients and tags are arrays held in their own
  // components' state and never reach here.
  const valueOf = (
    field: Exclude<keyof RecipeFormValues, "ingredients" | "tags">
  ) => state.values?.[field] ?? values[field] ?? ""
  const describedBy = (field: keyof RecipeFormValues, hasDescription = false) =>
    [
      hasDescription ? `${field}-description` : null,
      errorOf(field) ? `${field}-error` : null,
    ]
      .filter((id) => id !== null)
      .join(" ") || undefined

  useEffect(() => {
    const firstInvalidField = FIELD_ORDER.find(
      (field) => state.errors[field]?.length
    )
    if (firstInvalidField !== undefined) {
      document.getElementById(firstInvalidField)?.focus()
    }
  }, [state])

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {values.id === undefined ? null : (
        <input type="hidden" name="id" value={valueOf("id")} />
      )}

      {/* Notes are not editable in the UI for now, but the column and the
          value survive: without this the next save would blank them. */}
      <input type="hidden" name="notes" value={valueOf("notes")} />

      <FieldGroup>
        <Field data-invalid={invalid("title")}>
          <FieldLabel htmlFor="title">Nome</FieldLabel>
          <Input
            id="title"
            name="title"
            defaultValue={valueOf("title")}
            aria-invalid={errorOf("title") ? true : undefined}
            aria-describedby={describedBy("title")}
            required
          />
          <FieldError id="title-error">{errorOf("title")}</FieldError>
        </Field>

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
          <Field data-invalid={invalid("servings")}>
            <FieldLabel htmlFor="servings">Porzioni</FieldLabel>
            <Input
              id="servings"
              name="servings"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={valueOf("servings")}
              aria-invalid={errorOf("servings") ? true : undefined}
              aria-describedby={describedBy("servings")}
            />
            <FieldError id="servings-error">{errorOf("servings")}</FieldError>
          </Field>

          <Field data-invalid={invalid("totalMinutes")}>
            <FieldLabel htmlFor="totalMinutes">Minuti</FieldLabel>
            <Input
              id="totalMinutes"
              name="totalMinutes"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={valueOf("totalMinutes")}
              aria-invalid={errorOf("totalMinutes") ? true : undefined}
              aria-describedby={describedBy("totalMinutes")}
            />
            <FieldError id="totalMinutes-error">
              {errorOf("totalMinutes")}
            </FieldError>
          </Field>
        </div>

        <Field data-invalid={invalid("instructions")}>
          <FieldLabel htmlFor="instructions">Preparazione</FieldLabel>
          <Textarea
            id="instructions"
            name="instructions"
            defaultValue={valueOf("instructions")}
            rows={14}
            aria-invalid={errorOf("instructions") ? true : undefined}
            aria-describedby={describedBy("instructions")}
          />
          <FieldError id="instructions-error">
            {errorOf("instructions")}
          </FieldError>
        </Field>

        <fieldset>
          <legend className="mb-2 text-xs font-medium">Etichette</legend>
          <TagPicker suggestions={tagSuggestions} defaultTags={values.tags} />
          {errorOf("tags") === undefined ? null : (
            <p role="alert" className="text-xs text-destructive">
              {errorOf("tags")}
            </p>
          )}
        </fieldset>

        <Field data-invalid={invalid("sourceUrl")}>
          <FieldLabel htmlFor="sourceUrl">Fonte</FieldLabel>
          <Input
            id="sourceUrl"
            name="sourceUrl"
            type="url"
            inputMode="url"
            spellCheck={false}
            defaultValue={valueOf("sourceUrl")}
            aria-invalid={errorOf("sourceUrl") ? true : undefined}
            aria-describedby={describedBy("sourceUrl")}
          />
          <FieldError id="sourceUrl-error">{errorOf("sourceUrl")}</FieldError>
        </Field>
      </FieldGroup>

      {state.message === null ? null : (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvo…" : "Salva"}
        </Button>
        <Button
          variant="ghost"
          render={
            <Link href={values.id ? `/recipes/${values.id}` : "/recipes"} />
          }
          nativeButton={false}
        >
          Annulla
        </Button>
      </div>
    </form>
  )
}
