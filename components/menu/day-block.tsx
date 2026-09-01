import { BookOpen, Plus } from "lucide-react"
import Link from "next/link"

import type { StoredEntry } from "@/components/menu/entry-drawer"
import { Card } from "@/components/ui/card"

const TAP =
  "rounded-md transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"

type Meal = "LUNCH" | "DINNER"

const MEALS = [
  { meal: "LUNCH", label: "Pranzo" },
  { meal: "DINNER", label: "Cena" },
] as const

// Two controls side by side rather than one: a link inside a button is invalid
// markup, and the whole point is that they lead to different places — the
// drawer that changes the dish, and the recipe itself.
function EntryRow({
  entry,
  onOpen,
}: {
  entry: StoredEntry
  onOpen: () => void
}) {
  const content = entry.recipeTitle ?? entry.freeText

  return (
    <div className="flex items-stretch">
      <button
        type="button"
        onClick={onOpen}
        className={`flex min-h-12 flex-1 items-center px-3 py-2 text-left ${TAP}`}
      >
        {/* A dish with neither a recipe nor a note still exists when it carries
            only servings, or when the recipe behind it was deleted and the
            foreign key set to null. Rare, and not a reason to render nothing. */}
        <span
          className={
            content === null
              ? "text-sm text-muted-foreground"
              : entry.recipeTitle === null
                ? "text-sm break-words text-muted-foreground italic"
                : "text-sm font-medium break-words"
          }
        >
          {content ?? "Vuoto"}
        </span>
      </button>

      {/* Only where there is a recipe to open. A note has no page, and the
          title is named too because it is what names the link. */}
      {entry.recipeId === null || entry.recipeTitle === null ? null : (
        <Link
          href={`/recipes/${entry.recipeId}`}
          aria-label={`Apri la ricetta ${entry.recipeTitle}`}
          className={`flex w-11 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground ${TAP}`}
        >
          <BookOpen aria-hidden="true" className="size-4" />
        </Link>
      )}
    </div>
  )
}

function MealBlock({
  day,
  meal,
  mealLabel,
  dayLabel,
  entries,
  onAdd,
  onOpen,
}: {
  day: number
  meal: Meal
  mealLabel: string
  dayLabel: string
  entries: StoredEntry[]
  onAdd: (day: number, meal: Meal) => void
  onOpen: (entry: StoredEntry) => void
}) {
  return (
    <section aria-label={`${mealLabel} — ${dayLabel}`}>
      {/* Upper case rather than heavier: the dish titles below are the only
          thing on the card that should be dark, and at 390px a medium-weight
          muted heading reads as just another line. */}
      <div className="flex items-center justify-between gap-2 pt-2 pl-3">
        <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {mealLabel}
        </h3>
        <button
          type="button"
          onClick={() => onAdd(day, meal)}
          aria-label={`Aggiungi un piatto a ${mealLabel} di ${dayLabel}`}
          className={`flex size-11 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground ${TAP}`}
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </div>

      {entries.map((entry) => (
        <EntryRow key={entry.id} entry={entry} onOpen={() => onOpen(entry)} />
      ))}
    </section>
  )
}

export function DayBlock({
  day,
  label,
  isToday,
  entries,
  onAdd,
  onOpen,
}: {
  day: number
  label: string
  isToday: boolean
  entries: StoredEntry[]
  onAdd: (day: number, meal: Meal) => void
  onOpen: (entry: StoredEntry) => void
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
      <Card className="gap-0 p-1 pb-2">
        {MEALS.map(({ meal, label: mealLabel }) => (
          <MealBlock
            key={meal}
            day={day}
            meal={meal}
            mealLabel={mealLabel}
            dayLabel={label}
            entries={entries.filter((entry) => entry.meal === meal)}
            onAdd={onAdd}
            onOpen={onOpen}
          />
        ))}
      </Card>
    </section>
  )
}
