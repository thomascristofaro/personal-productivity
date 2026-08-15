"use client"

import Link from "next/link"
import { useActionState, useEffect } from "react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAttempt } from "@/hooks/use-attempt"

export type IngredientFormValues = {
  // Absent when creating. Carried as a hidden field so a rename knows which
  // row to update: the name is the primary key, so the new value cannot
  // identify the old row.
  originalName?: string
  name: string
  defaultUnit: string
  aisle: string
}

export type IngredientFormState = {
  errors: Record<string, string[]>
  message: string | null
  values?: Record<string, string>
}

export type SaveIngredientAction = (
  state: IngredientFormState,
  formData: FormData
) => Promise<IngredientFormState>

export const EMPTY_INGREDIENT_FORM_STATE: IngredientFormState = {
  errors: {},
  message: null,
  values: undefined,
}

const FIELD_ORDER: (keyof IngredientFormValues)[] = [
  "name",
  "defaultUnit",
  "aisle",
]

export function IngredientForm({
  values,
  action,
  aisles,
  units,
}: {
  values: IngredientFormValues
  action: SaveIngredientAction
  aisles: readonly string[]
  units: string[]
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    EMPTY_INGREDIENT_FORM_STATE
  )
  const attempt = useAttempt(state)

  const errorOf = (field: keyof IngredientFormValues) =>
    state.errors[field]?.[0]
  const invalid = (field: keyof IngredientFormValues) =>
    errorOf(field) ? "true" : undefined
  // React 19 resets the form to its defaultValues before an action-driven
  // submit runs. Reading the echoed value first keeps what the user typed.
  const valueOf = (field: keyof IngredientFormValues) =>
    state.values?.[field] ?? values[field] ?? ""
  const describedBy = (
    field: keyof IngredientFormValues,
    hasDescription = false
  ) =>
    [
      hasDescription ? `${field}-description` : null,
      errorOf(field) ? `${field}-error` : null,
    ]
      .filter((id) => id !== null)
      .join(" ") || undefined

  useEffect(() => {
    const firstInvalid = FIELD_ORDER.find(
      (field) => state.errors[field]?.length
    )
    if (firstInvalid !== undefined) {
      document.getElementById(firstInvalid)?.focus()
    }
  }, [state])

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {values.originalName === undefined ? null : (
        <input
          type="hidden"
          name="originalName"
          value={valueOf("originalName")}
        />
      )}

      <FieldGroup key={attempt}>
        <Field data-invalid={invalid("name")}>
          <FieldLabel htmlFor="name">Nome</FieldLabel>
          <Input
            id="name"
            name="name"
            defaultValue={valueOf("name")}
            autoComplete="off"
            aria-invalid={errorOf("name") ? true : undefined}
            aria-describedby={describedBy("name")}
            required
          />
          <FieldError id="name-error">{errorOf("name")}</FieldError>
        </Field>

        <Field data-invalid={invalid("defaultUnit")}>
          <FieldLabel htmlFor="defaultUnit">Unità preferita</FieldLabel>
          <Input
            id="defaultUnit"
            name="defaultUnit"
            defaultValue={valueOf("defaultUnit")}
            list="unit-suggestions"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={errorOf("defaultUnit") ? true : undefined}
            aria-describedby={describedBy("defaultUnit", true)}
          />
          <datalist id="unit-suggestions">
            {units.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
          <FieldDescription id="defaultUnit-description">
            Riempie la riga della ricetta. Lascia vuoto se si conta a pezzi.
          </FieldDescription>
          <FieldError id="defaultUnit-error">
            {errorOf("defaultUnit")}
          </FieldError>
        </Field>

        <Field data-invalid={invalid("aisle")}>
          <FieldLabel htmlFor="aisle">Reparto</FieldLabel>
          <Select name="aisle" defaultValue={valueOf("aisle")}>
            <SelectTrigger
              id="aisle"
              aria-invalid={errorOf("aisle") ? true : undefined}
              aria-describedby={describedBy("aisle", true)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {aisles.map((aisle) => (
                <SelectItem key={aisle} value={aisle}>
                  {aisle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription id="aisle-description">
            Decide dove finisce nella lista della spesa.
          </FieldDescription>
          <FieldError id="aisle-error">{errorOf("aisle")}</FieldError>
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
          render={<Link href="/ingredients" />}
          nativeButton={false}
        >
          Annulla
        </Button>
      </div>
    </form>
  )
}
