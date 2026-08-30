"use client"

import { useState } from "react"

import {
  RecipePicker,
  type RecipeOption,
} from "@/components/menu/recipe-picker"
import { FormDrawer } from "@/components/page/form-drawer"
import { FormField } from "@/components/page/form-field"
import { NumberField, TextField } from "@/components/page/fields"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useFormState } from "@/hooks/use-form-state"
import { COURSE_LABELS, type Course } from "@/lib/courses"
import type { FormAction } from "@/lib/form"

export type SlotDrawerValues = {
  day: number
  meal: "LUNCH" | "DINNER"
  course: Course
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
    slot.recipeId === null
      ? null
      : (recipes.find((recipe) => recipe.id === slot.recipeId) ?? null)
  )

  const [showAll, setShowAll] = useState(false)

  // The recipe already in the slot stays listed whatever its course, or a
  // cross-course assignment would vanish from its own picker the moment the
  // drawer reopened.
  const offered = showAll
    ? recipes
    : recipes.filter(
        (recipe) => recipe.course === slot.course || recipe.id === picked?.id
      )

  const mealLabel = slot.meal === "LUNCH" ? "Pranzo" : "Cena"

  return (
    <FormDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      form={form}
      title={`${dayLabel} · ${mealLabel} · ${COURSE_LABELS[slot.course]}`}
      description="Scegli una ricetta, oppure scrivi una nota per un pasto che non si cucina. Svuota i campi per liberare lo slot."
      submitLabel="Salva"
      pendingLabel="Salvo…"
    >
      <input type="hidden" name="weekStart" value={weekStart} />
      <input type="hidden" name="day" value={slot.day} />
      <input type="hidden" name="meal" value={slot.meal} />
      <input type="hidden" name="course" value={slot.course} />
      <input type="hidden" name="recipeId" value={picked?.id ?? ""} />

      <FormField
        name="recipe"
        label="Ricetta"
        description="Scrivi per filtrare il ricettario. La ✕ la toglie."
      >
        <RecipePicker
          id="recipe"
          recipes={offered}
          value={picked}
          onSelect={setPicked}
          aria-describedby="recipe-description"
        />
        {/* The escape hatch the filter needs. A slot that could only ever hold
            its own course would be the same trap as one dish per meal, only
            smaller — 2026-08-30 design document section 3.1. */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-all"
            checked={showAll}
            onCheckedChange={setShowAll}
          />
          <Label htmlFor="show-all" className="text-xs font-normal">
            Mostra tutte le ricette
          </Label>
        </div>
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
