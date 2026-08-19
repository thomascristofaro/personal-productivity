import { Undo2 } from "lucide-react"

import type { ShoppingRow } from "@/components/shopping/shopping-item-row"
import { Button } from "@/components/ui/button"
import { amountOf } from "@/lib/units"

/**
 * The lines taken off the list, and the way back.
 *
 * A server component: nothing here is interactive beyond a form, and keeping it
 * off the client is what lets the whole block cost nothing on a list where
 * nobody has removed anything.
 */
export function DismissedList({
  lines,
  weekStart,
  restoreAction,
}: {
  lines: ShoppingRow[]
  weekStart: string
  restoreAction: (formData: FormData) => Promise<void>
}) {
  if (lines.length === 0) return null

  return (
    <section className="flex flex-col gap-1 border-t pt-4">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Tolte dalla lista
      </h2>

      <ul className="flex flex-col">
        {lines.map((line) => {
          const amount = amountOf(line.quantity, line.unit)

          return (
            <li key={line.key} className="flex items-center gap-3 py-1">
              <span className="flex flex-1 flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground">
                <span className="break-words">{line.name}</span>
                {amount === null ? null : (
                  <span className="text-xs tabular-nums">{amount}</span>
                )}
              </span>

              <form action={restoreAction}>
                <input type="hidden" name="weekStart" value={weekStart} />
                {line.ids.map((id) => (
                  <input key={id} type="hidden" name="id" value={id} />
                ))}
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Rimetti ${line.name} nella lista`}
                >
                  <Undo2 aria-hidden="true" />
                </Button>
              </form>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
