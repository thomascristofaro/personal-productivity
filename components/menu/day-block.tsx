import type { SlotDrawerValues } from "@/components/menu/slot-drawer"
import { Card } from "@/components/ui/card"

function SlotButton({
  slot,
  onOpen,
}: {
  slot: SlotDrawerValues
  onOpen: () => void
}) {
  const label = slot.meal === "LUNCH" ? "Pranzo" : "Cena"
  const content = slot.recipeTitle ?? slot.freeText

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-14 w-full flex-col justify-center gap-0.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
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
          <SlotButton key={slot.meal} slot={slot} onOpen={() => onOpen(slot)} />
        ))}
      </Card>
    </section>
  )
}
