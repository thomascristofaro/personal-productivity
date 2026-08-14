"use client"

import Link from "next/link"
import { useActionState } from "react"

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

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {values.id === undefined ? null : (
        <input type="hidden" name="id" value={values.id} />
      )}

      <FieldGroup>
        <Field data-invalid={invalid("title")}>
          <FieldLabel htmlFor="title">Nome</FieldLabel>
          <Input
            id="title"
            name="title"
            defaultValue={values.title}
            aria-invalid={errorOf("title") ? true : undefined}
            required
          />
          <FieldError>{errorOf("title")}</FieldError>
        </Field>

        <Field data-invalid={invalid("ingredients")}>
          <FieldLabel htmlFor="ingredients">Ingredienti</FieldLabel>
          <Textarea
            id="ingredients"
            name="ingredients"
            defaultValue={values.ingredients}
            rows={8}
            placeholder={"320 g di spaghetti\n2 uova\nsale q.b."}
            aria-invalid={errorOf("ingredients") ? true : undefined}
            required
          />
          <FieldDescription>
            Uno per riga, come lo scriveresti a mano.
          </FieldDescription>
          <FieldError>{errorOf("ingredients")}</FieldError>
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
              defaultValue={values.servings}
              aria-invalid={errorOf("servings") ? true : undefined}
            />
            <FieldError>{errorOf("servings")}</FieldError>
          </Field>

          <Field data-invalid={invalid("totalMinutes")}>
            <FieldLabel htmlFor="totalMinutes">Minuti</FieldLabel>
            <Input
              id="totalMinutes"
              name="totalMinutes"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={values.totalMinutes}
              aria-invalid={errorOf("totalMinutes") ? true : undefined}
            />
            <FieldError>{errorOf("totalMinutes")}</FieldError>
          </Field>
        </div>

        <Field data-invalid={invalid("instructions")}>
          <FieldLabel htmlFor="instructions">Preparazione</FieldLabel>
          <Textarea
            id="instructions"
            name="instructions"
            defaultValue={values.instructions}
            rows={8}
            aria-invalid={errorOf("instructions") ? true : undefined}
          />
          <FieldError>{errorOf("instructions")}</FieldError>
        </Field>

        <Field data-invalid={invalid("tags")}>
          <FieldLabel htmlFor="tags">Etichette</FieldLabel>
          <Input
            id="tags"
            name="tags"
            defaultValue={values.tags}
            placeholder="pesce, veloce"
            aria-invalid={errorOf("tags") ? true : undefined}
          />
          <FieldDescription>Separate da virgola.</FieldDescription>
          <FieldError>{errorOf("tags")}</FieldError>
        </Field>

        <Field data-invalid={invalid("sourceUrl")}>
          <FieldLabel htmlFor="sourceUrl">Fonte</FieldLabel>
          <Input
            id="sourceUrl"
            name="sourceUrl"
            type="url"
            inputMode="url"
            defaultValue={values.sourceUrl}
            aria-invalid={errorOf("sourceUrl") ? true : undefined}
          />
          <FieldError>{errorOf("sourceUrl")}</FieldError>
        </Field>

        <Field data-invalid={invalid("notes")}>
          <FieldLabel htmlFor="notes">Note</FieldLabel>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={values.notes}
            rows={3}
            aria-invalid={errorOf("notes") ? true : undefined}
          />
          <FieldError>{errorOf("notes")}</FieldError>
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
