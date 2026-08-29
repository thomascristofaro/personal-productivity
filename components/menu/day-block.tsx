import { BookOpen } from "lucide-react"
import Link from "next/link"

import type { SlotDrawerValues } from "@/components/menu/slot-drawer"
import { Card } from "@/components/ui/card"

const TAP =
  "rounded-md transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"

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
  const label = slot.meal === "LUNCH" ? "Pranzo" : "Cena"
  const content = slot.recipeTitle ?? slot.freeText

  return (
    <div className="flex items-stretch">
      <button
        type="button"
        onClick={onOpen}
        className={`flex min-h-14 flex-1 flex-col justify-center gap-0.5 px-3 py-2 text-left ${TAP}`}
      >
        <span className="text-xs text-muted-foreground">{label}</span>
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

export function DayBlock({
  label,
  isToday,
  slots,
  onOpen,
}: {
  label: string
  isToday: boolean
  slots: SlotDrawerValues[]
  onOpen: (slot: SlotDrawerValues) => void
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
        {slots.map((slot) => (
          <SlotRow key={slot.meal} slot={slot} onOpen={() => onOpen(slot)} />
        ))}
      </Card>
    </section>
  )
}
