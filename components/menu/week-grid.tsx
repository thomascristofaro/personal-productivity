"use client"

import { useCallback, useState } from "react"

import { DayBlock } from "@/components/menu/day-block"
import {
  EntryDrawer,
  type MenuEntryValues,
  type StoredEntry,
} from "@/components/menu/entry-drawer"
import type { RecipeOption } from "@/components/menu/recipe-picker"
import type { FormAction } from "@/lib/form"

type Meal = "LUNCH" | "DINNER"

// What the drawer is open on: an existing dish, named by its id, or a new one
// being added to a meal. Two shapes rather than one nullable id, so "adding to
// Tuesday lunch" cannot be confused with "editing a dish that has no id yet".
type Editing =
  { kind: "existing"; id: string } | { kind: "new"; day: number; meal: Meal }

const empty = (day: number, meal: Meal): MenuEntryValues => ({
  day,
  meal,
  recipeId: null,
  recipeTitle: null,
  freeText: null,
  servings: null,
})

// One drawer for the whole week rather than one per row: the recipe list would
// otherwise be serialised into the payload once per dish on screen.
export function WeekGrid({
  weekStart,
  entries,
  dayLabels,
  todayIndex,
  recipes,
  saveAction,
}: {
  weekStart: string
  entries: StoredEntry[]
  dayLabels: string[]
  // -1 when the week on screen is not the current one.
  todayIndex: number
  recipes: RecipeOption[]
  saveAction: FormAction
}) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const close = useCallback(() => setEditing(null), [])

  // Derived from the props rather than held in state, so a dish edited in one
  // drawer and re-opened shows what the server now holds.
  const open: MenuEntryValues | null =
    editing === null
      ? null
      : editing.kind === "new"
        ? empty(editing.day, editing.meal)
        : (entries.find((entry) => entry.id === editing.id) ?? null)

  return (
    <div className="flex flex-col gap-4">
      {dayLabels.map((label, day) => (
        <DayBlock
          key={day}
          day={day}
          label={label}
          isToday={day === todayIndex}
          entries={entries.filter((entry) => entry.day === day)}
          onAdd={(atDay, meal) => setEditing({ kind: "new", day: atDay, meal })}
          onOpen={(entry) => setEditing({ kind: "existing", id: entry.id })}
        />
      ))}

      {open === null ? null : (
        <EntryDrawer
          // Remounts when the dish changes, so the drawer's local picker state
          // never carries one dish's recipe into the next one. A new dish is
          // keyed by the meal it is joining, which is all it has.
          key={open.id ?? `new-${open.day}-${open.meal}`}
          open={true}
          onClose={close}
          entry={open}
          weekStart={weekStart}
          dayLabel={dayLabels[open.day]}
          recipes={recipes}
          saveAction={saveAction}
        />
      )}
    </div>
  )
}
