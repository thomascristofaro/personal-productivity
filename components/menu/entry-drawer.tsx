"use client"

import { useState } from "react"

import {
  RecipePicker,
  type RecipeOption,
} from "@/components/menu/recipe-picker"
import { FormDrawer } from "@/components/page/form-drawer"
import { FormField } from "@/components/page/form-field"
import { NumberField, TextField } from "@/components/page/fields"
import { useFormState } from "@/hooks/use-form-state"
import type { FormAction } from "@/lib/form"

export type MenuEntryValues = {
  // Absent while the dish is being added: there is no row yet to name. Every
  // dish on screen has one — see StoredEntry, which the grid uses.
  id?: string
  day: number
  meal: "LUNCH" | "DINNER"
  recipeId: string | null
  recipeTitle: string | null
  freeText: string | null
  servings: number | null
}

/** A dish that exists. Everything the grid renders is one. */
export type StoredEntry = MenuEntryValues & { id: string }

const FIELD_ORDER = ["freeText", "servings"] as const

export function EntryDrawer({
  open,
  onClose,
  entry,
  weekStart,
  dayLabel,
  recipes,
  saveAction,
}: {
  open: boolean
  onClose: () => void
  entry: MenuEntryValues
  weekStart: string
  dayLabel: string
  recipes: RecipeOption[]
  saveAction: FormAction
}) {
  const form = useFormState(saveAction, FIELD_ORDER, {
    freeText: entry.freeText ?? "",
    servings: entry.servings === null ? "" : String(entry.servings),
  })

  const [picked, setPicked] = useState<RecipeOption | null>(
    entry.recipeId === null
      ? null
      : (recipes.find((recipe) => recipe.id === entry.recipeId) ?? null)
  )

  const mealLabel = entry.meal === "LUNCH" ? "Pranzo" : "Cena"

  return (
    <FormDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      form={form}
      title={`${dayLabel} · ${mealLabel}`}
      description={
        entry.id === undefined
          ? "Scegli una ricetta, oppure scrivi una nota per un pasto che non si cucina."
          : "Scegli una ricetta, oppure scrivi una nota per un pasto che non si cucina. Svuota i campi per togliere il piatto."
      }
      submitLabel="Salva"
      pendingLabel="Salvo…"
    >
      <input type="hidden" name="weekStart" value={weekStart} />
      {/* The three that address a new dish, and the one that names an existing
          one. The action reads `entryId` first and only falls back to the meal,
          so a dish being edited never moves to another day by accident. */}
      <input type="hidden" name="day" value={entry.day} />
      <input type="hidden" name="meal" value={entry.meal} />
      {entry.id === undefined ? null : (
        <input type="hidden" name="entryId" value={entry.id} />
      )}
      <input type="hidden" name="recipeId" value={picked?.id ?? ""} />

      <FormField
        name="recipe"
        label="Ricetta"
        description="Scrivi per filtrare il ricettario. La ✕ la toglie."
      >
        <RecipePicker
          id="recipe"
          recipes={recipes}
          value={picked}
          onSelect={setPicked}
          aria-describedby="recipe-description"
        />
      </FormField>

      <TextField
        {...form.fieldProps("freeText")}
        label="Oppure una nota"
        error={form.errorOf("freeText")}
        description="Una nota non finisce nella lista della spesa."
        autoComplete="off"
        placeholder="fuori a cena…"
      />

      <NumberField
        {...form.fieldProps("servings")}
        label="Porzioni"
        error={form.errorOf("servings")}
        description="Lascia vuoto per le porzioni di casa."
        min={1}
        max={20}
        autoComplete="off"
      />
    </FormDrawer>
  )
}
