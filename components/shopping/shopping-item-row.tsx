"use client"

import { Minus, Pencil, Plus, Trash2 } from "lucide-react"
import { useOptimistic, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { amountOf, isCountable, takenAmountOf } from "@/lib/units"

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
  takenQuantity: number | null
  dismissed: boolean
}

// Three fit on a 390px row beside a name and a quantity; a fourth wraps.
const DAYS_SHOWN = 3

function shortDays(days: number[], labels: string[]): string | null {
  if (days.length === 0) return null
  const named = days.map((day) => labels[day] ?? "?")
  if (named.length <= DAYS_SHOWN) return named.join(", ")
  return `${named.slice(0, 2).join(", ")} +${named.length - 2}`
}

// What the pencil starts from: what was already decided, or the whole line.
const startingPoint = (line: ShoppingRow) => line.takenQuantity ?? line.quantity

export function ShoppingItemRow({
  line,
  dayLabels,
  toggleAction,
  removeAction,
  takeAction,
}: {
  line: ShoppingRow
  dayLabels: string[]
  toggleAction: (formData: FormData) => Promise<void>
  removeAction: (formData: FormData) => Promise<void>
  takeAction: (formData: FormData) => Promise<void>
}) {
  // The list is read standing in a shop on one bar of signal. A checkbox that
  // waits for the server before moving reads as broken.
  const [checked, setChecked] = useOptimistic(line.checked)
  const [taken, setTaken] = useOptimistic(line.takenQuantity)
  const [, startTransition] = useTransition()

  const [editing, setEditing] = useState(false)
  // A string and not a number: an input being typed into passes through "" and
  // "1," and neither is a number, but both have to survive a keystroke.
  const [draft, setDraft] = useState("")

  const amount = takenAmountOf(taken, line.quantity, line.unit)
  const asked = amountOf(line.quantity, line.unit)
  const short = shortDays(line.days, dayLabels)
  const full = line.days.map((day) => dayLabels[day] ?? "?").join(", ")
  // Keyed on the line and not on a row id: a regeneration renumbers every row,
  // and the label has to keep pointing at the checkbox across it.
  const inputId = `line-${line.key}`
  const takenId = `taken-${line.key}`
  const countable = isCountable(line.unit)

  const post = (
    action: (formData: FormData) => Promise<void>,
    fill: (data: FormData) => void
  ) => {
    const data = new FormData()
    for (const id of line.ids) data.append("id", id)
    fill(data)
    return action(data)
  }

  const commit = (next: number | null) => {
    setDraft(next === null ? "" : String(next))
    startTransition(async () => {
      setTaken(next)
      await post(takeAction, (data) =>
        data.set("taken", next === null ? "" : String(next))
      )
    })
  }

  // Never below one: taking none of something is the bin, not a quantity.
  const step = (by: number) =>
    commit(Math.max(1, (Number(draft) || startingPoint(line) || 1) + by))

  const commitDraft = () => {
    const text = draft.trim().replace(",", ".")
    // An empty field means "all of it", which is what a line with no correction
    // shows. Anything unreadable leaves the stored value alone.
    if (text === "") return commit(null)

    const next = Number(text)
    if (!Number.isFinite(next) || next <= 0) {
      return setDraft(String(startingPoint(line) ?? ""))
    }
    if (next !== taken) commit(next)
  }

  return (
    <li className="flex flex-col py-1">
      <div className="flex items-center gap-3">
        <Checkbox
          id={inputId}
          checked={checked}
          onCheckedChange={(next: boolean) => {
            startTransition(async () => {
              setChecked(next)
              await post(toggleAction, (data) =>
                data.set("checked", next ? "1" : "")
              )
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

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-expanded={editing}
          aria-controls={editing ? takenId : undefined}
          aria-label={`Quanto prendi di ${line.name}`}
          onClick={() => {
            setDraft(String(startingPoint(line) ?? ""))
            setEditing((open) => !open)
          }}
        >
          <Pencil aria-hidden="true" />
        </Button>

        <form action={removeAction}>
          {line.ids.map((id) => (
            <input key={id} type="hidden" name="id" value={id} />
          ))}
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            aria-label={`Togli ${line.name} dalla lista`}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </form>
      </div>

      {editing ? (
        // Under the row rather than inside it: at 390px a stepper beside a name,
        // a quantity and two buttons has nowhere to stand.
        <div id={takenId} className="flex items-center gap-2 py-2 pl-9">
          {countable ? (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Uno in meno"
              onClick={() => step(-1)}
            >
              <Minus aria-hidden="true" />
            </Button>
          ) : null}

          <Input
            id={`${takenId}-field`}
            type="text"
            inputMode="decimal"
            className="w-20 text-center tabular-nums"
            aria-label={`Quantità presa di ${line.name}`}
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
          />

          {countable ? (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Uno in più"
              onClick={() => step(1)}
            >
              <Plus aria-hidden="true" />
            </Button>
          ) : null}

          {asked === null ? null : (
            <span className="text-xs text-muted-foreground">di {asked}</span>
          )}
        </div>
      ) : null}
    </li>
  )
}
