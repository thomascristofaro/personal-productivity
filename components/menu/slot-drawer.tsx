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

export type SlotDrawerValues = {
  day: number
  meal: "LUNCH" | "DINNER"
  recipeId: string | null
  recipeTitle: string | null
  freeText: string | null
  servings: number | null
}

const FIELD_ORDER = ["freeText", "servings"] as const

export function SlotDrawer({
  open,
  onClose,
  slot,
  weekStart,
  dayLabel,
  recipes,
  saveAction,
}: {
  open: boolean
  onClose: () => void
  slot: SlotDrawerValues
  weekStart: string
  dayLabel: string
  recipes: RecipeOption[]
  saveAction: FormAction
}) {
  const form = useFormState(saveAction, FIELD_ORDER, {
    freeText: slot.freeText ?? "",
    servings: slot.servings === null ? "" : String(slot.servings),
  })

  const [picked, setPicked] = useState<RecipeOption | null>(
    slot.recipeId === null || slot.recipeTitle === null
      ? null
      : { id: slot.recipeId, title: slot.recipeTitle }
  )

  const mealLabel = slot.meal === "LUNCH" ? "Pranzo" : "Cena"

  return (
    <FormDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      form={form}
      title={`${dayLabel} · ${mealLabel}`}
      description="Scegli una ricetta, oppure scrivi una nota per un pasto che non si cucina. Svuota i campi per liberare lo slot."
      submitLabel="Salva"
      pendingLabel="Salvo…"
    >
      <input type="hidden" name="weekStart" value={weekStart} />
      <input type="hidden" name="day" value={slot.day} />
      <input type="hidden" name="meal" value={slot.meal} />
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
