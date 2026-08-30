"use client"

import { useCallback, useState } from "react"

import { DayBlock } from "@/components/menu/day-block"
import type { RecipeOption } from "@/components/menu/recipe-picker"
import {
  SlotDrawer,
  type SlotDrawerValues,
} from "@/components/menu/slot-drawer"
import type { Course } from "@/lib/courses"
import type { FormAction } from "@/lib/form"

type Address = { day: number; meal: "LUNCH" | "DINNER"; course: Course }

// Keys the drawer's remount, which is what makes a chip and the row it becomes
// two different drawers rather than one that remembers the wrong slot.
const keyOf = (address: Address) =>
  `${address.day}-${address.meal}-${address.course}`

// One drawer for the whole week rather than one per slot: the recipe list would
// otherwise be serialised into the payload forty-two times.
export function WeekGrid({
  weekStart,
  slots,
  dayLabels,
  todayIndex,
  recipes,
  saveAction,
}: {
  weekStart: string
  slots: SlotDrawerValues[]
  dayLabels: string[]
  // -1 when the week on screen is not the current one.
  todayIndex: number
  recipes: RecipeOption[]
  saveAction: FormAction
}) {
  // The address rather than the slot itself: a chip addresses a slot that does
  // not exist yet, and holding the address keeps the drawer reading from fresh
  // props for the one that does.
  const [address, setAddress] = useState<Address | null>(null)
  const close = useCallback(() => setAddress(null), [])

  const open: SlotDrawerValues | null =
    address === null
      ? null
      : (slots.find(
          (slot) =>
            slot.day === address.day &&
            slot.meal === address.meal &&
            slot.course === address.course
        ) ?? {
          ...address,
          recipeId: null,
          recipeTitle: null,
          freeText: null,
          servings: null,
        })

  return (
    <div className="flex flex-col gap-4">
      {dayLabels.map((label, day) => (
        <DayBlock
          key={day}
          day={day}
          label={label}
          isToday={day === todayIndex}
          slots={slots.filter((slot) => slot.day === day)}
          // Parameters named apart from the `day` of the enclosing map: the
          // slot's day is the one the caller passes, and shadowing it here is
          // how the two silently become the same thing when one of them moves.
          onOpen={(atDay, meal, course) =>
            setAddress({ day: atDay, meal, course })
          }
        />
      ))}

      {open === null || address === null ? null : (
        <SlotDrawer
          key={keyOf(address)}
          open={true}
          onClose={close}
          slot={open}
          weekStart={weekStart}
          dayLabel={dayLabels[open.day]}
          recipes={recipes}
          saveAction={saveAction}
        />
      )}
    </div>
  )
}
