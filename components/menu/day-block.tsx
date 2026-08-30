import { BookOpen, Plus } from "lucide-react"
import Link from "next/link"

import type { SlotDrawerValues } from "@/components/menu/slot-drawer"
import { Card } from "@/components/ui/card"
import { COURSE_LABELS, COURSES, type Course } from "@/lib/courses"

const TAP =
  "rounded-md transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"

type Meal = "LUNCH" | "DINNER"

const MEALS = [
  { meal: "LUNCH", label: "Pranzo" },
  { meal: "DINNER", label: "Cena" },
] as const

type OpenSlot = (day: number, meal: Meal, course: Course) => void

// Two controls side by side rather than one: a link inside a button is invalid
// markup, and the whole point is that they lead to different places — the
// drawer that changes the slot, and the recipe itself.
function SlotRow({
  slot,
  onOpen,
}: {
  slot: SlotDrawerValues
  onOpen: () => void
}) {
  const content = slot.recipeTitle ?? slot.freeText

  return (
    <div className="flex items-stretch">
      <button
        type="button"
        onClick={onOpen}
        className={`flex min-h-14 flex-1 flex-col justify-center gap-0.5 px-3 py-2 text-left ${TAP}`}
      >
        <span className="text-xs text-muted-foreground">
          {COURSE_LABELS[slot.course]}
        </span>
        {/* A row with neither a recipe nor a note still exists when it carries
            only servings, or when the recipe behind it was deleted and the
            foreign key set to null. Rare, and not a reason to render nothing. */}
        {content === null ? (
          <span className="text-sm text-muted-foreground">Vuoto</span>
        ) : (
          <span
            className={
              slot.recipeTitle === null
                ? "text-sm break-words text-muted-foreground italic"
                : "text-sm font-medium break-words"
            }
          >
            {content}
          </span>
        )}
      </button>

      {/* Only where there is a recipe to open. Free text has no page, and the
          title is tested too because it is what names the link. */}
      {slot.recipeId === null || slot.recipeTitle === null ? null : (
        <Link
          href={`/recipes/${slot.recipeId}`}
          aria-label={`Apri la ricetta ${slot.recipeTitle}`}
          className={`flex w-11 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground ${TAP}`}
        >
          <BookOpen aria-hidden="true" className="size-4" />
        </Link>
      )}
    </div>
  )
}

// One chip per course the meal does not hold. Rendering the three empty rows
// instead would triple the height of the week for gaps nobody intends to fill;
// three short words fit one line at 390px, and the slot stays one tap away.
function AddChip({
  course,
  mealLabel,
  dayLabel,
  onAdd,
}: {
  course: Course
  mealLabel: string
  dayLabel: string
  onAdd: () => void
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={`Aggiungi un ${COURSE_LABELS[course].toLowerCase()} a ${mealLabel} di ${dayLabel}`}
      className={`flex min-h-11 items-center gap-1 rounded-full border border-dashed border-input px-3 text-xs text-muted-foreground hover:text-foreground ${TAP}`}
    >
      <Plus aria-hidden="true" className="size-3.5" />
      {COURSE_LABELS[course]}
    </button>
  )
}

function MealBlock({
  day,
  meal,
  mealLabel,
  dayLabel,
  slots,
  onOpen,
}: {
  day: number
  meal: Meal
  mealLabel: string
  dayLabel: string
  slots: SlotDrawerValues[]
  onOpen: OpenSlot
}) {
  const missing = COURSES.filter(
    (course) => !slots.some((slot) => slot.course === course)
  )

  return (
    <section aria-label={`${mealLabel} — ${dayLabel}`}>
      {/* Upper case rather than heavier: the course label below it is also
          small and muted, and at 390px the two read as the same level unless
          the meal is marked as a section rather than as another line. */}
      <h3 className="px-3 pt-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {mealLabel}
      </h3>
      {slots.map((slot) => (
        <SlotRow
          key={slot.course}
          slot={slot}
          onOpen={() => onOpen(day, meal, slot.course)}
        />
      ))}
      {missing.length === 0 ? null : (
        <div className="flex flex-wrap gap-2 px-3 py-2">
          {missing.map((course) => (
            <AddChip
              key={course}
              course={course}
              mealLabel={mealLabel}
              dayLabel={dayLabel}
              onAdd={() => onOpen(day, meal, course)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export function DayBlock({
  day,
  label,
  isToday,
  slots,
  onOpen,
}: {
  day: number
  label: string
  isToday: boolean
  slots: SlotDrawerValues[]
  onOpen: OpenSlot
}) {
  return (
    <section aria-label={label} className="flex flex-col gap-1">
      <h2
        className={
          isToday
            ? "px-1 text-sm font-semibold text-foreground"
            : "px-1 text-sm font-medium text-muted-foreground"
        }
      >
        {label}
        {isToday ? <span className="sr-only"> — oggi</span> : null}
      </h2>
      <Card className="gap-0 p-1">
        {MEALS.map(({ meal, label: mealLabel }) => (
          <MealBlock
            key={meal}
            day={day}
            meal={meal}
            mealLabel={mealLabel}
            dayLabel={label}
            slots={slots.filter((slot) => slot.meal === meal)}
            onOpen={onOpen}
          />
        ))}
      </Card>
    </section>
  )
}
