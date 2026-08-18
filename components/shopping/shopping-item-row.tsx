"use client"

import { Trash2 } from "lucide-react"
import { useOptimistic, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { amountOf } from "@/lib/units"

// Declared here rather than imported from lib/services/shopping-view: this is
// client-reachable code, and the layering rule forbids the import. The page's
// call site is what checks the two agree.
export type ShoppingRow = {
  key: string
  ids: string[]
  manualIds: string[]
  name: string
  quantity: number | null
  unit: string | null
  days: number[]
  checked: boolean
}

// Three fit on a 390px row beside a name and a quantity; a fourth wraps.
const DAYS_SHOWN = 3

function shortDays(days: number[], labels: string[]): string | null {
  if (days.length === 0) return null
  const named = days.map((day) => labels[day] ?? "?")
  if (named.length <= DAYS_SHOWN) return named.join(", ")
  return `${named.slice(0, 2).join(", ")} +${named.length - 2}`
}

export function ShoppingItemRow({
  line,
  dayLabels,
  toggleAction,
  removeAction,
}: {
  line: ShoppingRow
  dayLabels: string[]
  toggleAction: (formData: FormData) => Promise<void>
  removeAction: (formData: FormData) => Promise<void>
}) {
  // The list is read standing in a shop on one bar of signal. A checkbox that
  // waits for the server before moving reads as broken.
  const [checked, setChecked] = useOptimistic(line.checked)
  const [, startTransition] = useTransition()

  const amount = amountOf(line.quantity, line.unit)
  const short = shortDays(line.days, dayLabels)
  const full = line.days.map((day) => dayLabels[day] ?? "?").join(", ")
  // Keyed on the line and not on a row id: a regeneration renumbers every row,
  // and the label has to keep pointing at the checkbox across it.
  const inputId = `line-${line.key}`

  return (
    <li className="flex items-center gap-3 py-1">
      <Checkbox
        id={inputId}
        checked={checked}
        onCheckedChange={(next: boolean) => {
          const data = new FormData()
          for (const id of line.ids) data.append("id", id)
          data.set("checked", next ? "1" : "")

          startTransition(async () => {
            setChecked(next)
            await toggleAction(data)
          })
        }}
      />
      <label
        htmlFor={inputId}
        className={
          checked
            ? "flex flex-1 flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground line-through"
            : "flex flex-1 flex-wrap items-baseline gap-x-2 text-sm"
        }
      >
        <span className="break-words">{line.name}</span>
        {amount === null ? null : (
          <span className="text-xs text-muted-foreground tabular-nums">
            {amount}
          </span>
        )}
        {short === null ? null : (
          <span className="text-xs text-muted-foreground">
            {/* "+2" is not a day. The abbreviation is for the eye and the full
                list for the screen reader, rather than one compromise for both. */}
            <span aria-hidden="true">{short}</span>
            <span className="sr-only">serve {full}</span>
          </span>
        )}
      </label>

      {line.manualIds.length === 0 ? null : (
        <form action={removeAction}>
          {line.manualIds.map((id) => (
            <input key={id} type="hidden" name="id" value={id} />
          ))}
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            // Two labels, because on a part-generated line the button does not
            // remove the line, and one saying it does would be a lie.
            aria-label={
              line.manualIds.length === line.ids.length
                ? `Togli ${line.name} dalla lista`
                : `Togli quello che hai aggiunto a ${line.name}`
            }
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </form>
      )}
    </li>
  )
}
