"use client"

import Link from "next/link"
import { useActionState, useEffect } from "react"

import {
  EMPTY_FORM_STATE,
  type SaveRecipeAction,
} from "@/components/recipes/recipe-form-state"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
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
  tags: string
  ingredients: string
}

// DOM order of the fields, so the first invalid one can take focus after a
// failed submit — the field ids double as this list.
const FIELD_ORDER: (keyof RecipeFormValues)[] = [
  "title",
  "ingredients",
  "servings",
  "totalMinutes",
  "instructions",
  "tags",
  "sourceUrl",
  "notes",
]

export function RecipeForm({
  values,
  action,
}: {
  values: RecipeFormValues
  action: SaveRecipeAction
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
  const valueOf = (field: keyof RecipeFormValues) =>
    state.values?.[field] ?? values[field] ?? ""
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

        <Field data-invalid={invalid("ingredients")}>
          <FieldLabel htmlFor="ingredients">Ingredienti</FieldLabel>
          <Textarea
            id="ingredients"
            name="ingredients"
            defaultValue={valueOf("ingredients")}
            rows={8}
            placeholder={"320 g di spaghetti\n2 uova\nsale q.b."}
            aria-invalid={errorOf("ingredients") ? true : undefined}
            aria-describedby={describedBy("ingredients", true)}
            required
          />
          <FieldDescription id="ingredients-description">
            Uno per riga, come lo scriveresti a mano.
          </FieldDescription>
          <FieldError id="ingredients-error">
            {errorOf("ingredients")}
          </FieldError>
        </Field>

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
            rows={8}
            aria-invalid={errorOf("instructions") ? true : undefined}
            aria-describedby={describedBy("instructions")}
          />
          <FieldError id="instructions-error">
            {errorOf("instructions")}
          </FieldError>
        </Field>

        <Field data-invalid={invalid("tags")}>
          <FieldLabel htmlFor="tags">Etichette</FieldLabel>
          <Input
            id="tags"
            name="tags"
            defaultValue={valueOf("tags")}
            placeholder="pesce, veloce"
            aria-invalid={errorOf("tags") ? true : undefined}
            aria-describedby={describedBy("tags", true)}
          />
          <FieldDescription id="tags-description">
            Separate da virgola.
          </FieldDescription>
          <FieldError id="tags-error">{errorOf("tags")}</FieldError>
        </Field>

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

        <Field data-invalid={invalid("notes")}>
          <FieldLabel htmlFor="notes">Note</FieldLabel>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={valueOf("notes")}
            rows={3}
            aria-invalid={errorOf("notes") ? true : undefined}
            aria-describedby={describedBy("notes")}
          />
          <FieldError id="notes-error">{errorOf("notes")}</FieldError>
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
