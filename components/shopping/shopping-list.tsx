"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { ListSection } from "@/components/page/list-section"
import {
  ShoppingItemRow,
  type ShoppingRow,
} from "@/components/shopping/shopping-item-row"
import { countLabel } from "@/lib/count-label"

export type ShoppingGroup = { aisle: string; lines: ShoppingRow[] }

// The zero case is not «Nessun articolo»: an empty list here is the good
// outcome, and it should read like one.
const LEFT_TO_TAKE = {
  none: "Tutto preso.",
  one: "articolo da prendere",
  many: "articoli da prendere",
}

// The other phone may be ticking items off at the same time. §6.3 settles the
// mechanism: refresh the server component, no JSON endpoint and no fetching
// library. Thirty seconds is slow enough to be invisible on a mobile connection
// and quick enough that two people in one shop do not buy the same thing twice.
const REFRESH_MS = 30_000

export function ShoppingList({
  groups,
  dayLabels,
  weekStart,
  toggleAction,
  removeAction,
  takeAction,
}: {
  groups: ShoppingGroup[]
  dayLabels: string[]
  weekStart: string
  toggleAction: (formData: FormData) => Promise<void>
  removeAction: (formData: FormData) => Promise<void>
  takeAction: (formData: FormData) => Promise<void>
}) {
  const router = useRouter()

  useEffect(() => {
    const refresh = () => {
      // Nothing to fetch for a screen nobody is looking at, and a phone in a
      // pocket must not poll.
      if (document.visibilityState === "visible") router.refresh()
    }

    const timer = window.setInterval(refresh, REFRESH_MS)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [router])

  const withWeek = (action: (formData: FormData) => Promise<void>) => {
    return async (formData: FormData) => {
      formData.set("weekStart", weekStart)
      return action(formData)
    }
  }

  // Counts lines, not rows: a merged line is one thing to pick up.
  const left = groups
    .flatMap((group) => group.lines)
    .filter((line) => !line.checked).length

  return (
    <div className="flex flex-col gap-6">
      {/* The other phone ticks items off and this screen refreshes silently.
          A count is the one thing worth announcing: the rows themselves would
          queue the whole list every thirty seconds. Identical text is not
          re-announced, so a quiet refresh stays quiet. */}
      <span role="status" aria-live="polite" className="sr-only">
        {countLabel(left, LEFT_TO_TAKE)}
      </span>

      {groups.map((group) => (
        <ListSection key={group.aisle} title={group.aisle}>
          {group.lines.map((line) => (
            <ShoppingItemRow
              key={line.key}
              line={line}
              dayLabels={dayLabels}
              toggleAction={withWeek(toggleAction)}
              removeAction={withWeek(removeAction)}
              takeAction={withWeek(takeAction)}
            />
          ))}
        </ListSection>
      ))}
    </div>
  )
}
