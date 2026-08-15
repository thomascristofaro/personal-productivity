"use client"

import { useCallback, useState } from "react"

import { DayBlock } from "@/components/menu/day-block"
import type { RecipeOption } from "@/components/menu/recipe-picker"
import {
  SlotDrawer,
  type SaveSlotAction,
  type SlotDrawerValues,
} from "@/components/menu/slot-drawer"

const keyOf = (slot: SlotDrawerValues) => `${slot.day}-${slot.meal}`

// One drawer for the whole week rather than one per slot: the recipe list
// would otherwise be serialised into the payload fourteen times.
export function WeekGrid({
  weekStart,
  slots,
  dayLabels,
  todayIndex,
  recipes,
  saveAction,
  clearAction,
}: {
  weekStart: string
  slots: SlotDrawerValues[]
  dayLabels: string[]
  // -1 when the week on screen is not the current one.
  todayIndex: number
  recipes: RecipeOption[]
  saveAction: SaveSlotAction
  clearAction: (formData: FormData) => Promise<void>
}) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  // Stable across renders, so the drawer's close-on-success effect does not
  // refire and shut the drawer the moment it is reopened.
  const close = useCallback(() => setOpenKey(null), [])

  const open = slots.find((slot) => keyOf(slot) === openKey) ?? null

  return (
    <div className="flex flex-col gap-4">
      {dayLabels.map((label, day) => (
        <DayBlock
          key={day}
          label={label}
          isToday={day === todayIndex}
          slots={slots.filter((slot) => slot.day === day)}
          onOpen={(slot) => setOpenKey(keyOf(slot))}
        />
      ))}

      {open === null ? null : (
        <SlotDrawer
          // Remounts when the slot changes, so the drawer's local picker state
          // never carries one slot's recipe into the next one.
          key={keyOf(open)}
          open={true}
          onClose={close}
          slot={open}
          weekStart={weekStart}
          dayLabel={dayLabels[open.day]}
          recipes={recipes}
          saveAction={saveAction}
          clearAction={clearAction}
        />
      )}
    </div>
  )
}
