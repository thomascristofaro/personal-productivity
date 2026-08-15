"use client"

import { Trash2 } from "lucide-react"
import { useOptimistic, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { amountOf } from "@/lib/units"

export type ShoppingRow = {
  id: string
  name: string
  quantity: number | null
  unit: string | null
  checked: boolean
  manual: boolean
}

export function ShoppingItemRow({
  item,
  toggleAction,
  removeAction,
}: {
  item: ShoppingRow
  toggleAction: (formData: FormData) => Promise<void>
  removeAction: (formData: FormData) => Promise<void>
}) {
  // The list is read standing in a shop on one bar of signal. A checkbox that
  // waits for the server before moving reads as broken.
  const [checked, setChecked] = useOptimistic(item.checked)
  const [, startTransition] = useTransition()
  const amount = amountOf(item.quantity, item.unit)

  return (
    <li className="flex items-center gap-3 py-1">
      <Checkbox
        id={item.id}
        checked={checked}
        onCheckedChange={(next: boolean) => {
          const data = new FormData()
          data.set("id", item.id)
          data.set("checked", next ? "1" : "")

          startTransition(async () => {
            setChecked(next)
            await toggleAction(data)
          })
        }}
      />
      <label
        htmlFor={item.id}
        className={
          checked
            ? "flex flex-1 flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground line-through"
            : "flex flex-1 flex-wrap items-baseline gap-x-2 text-sm"
        }
      >
        <span className="break-words">{item.name}</span>
        {amount === null ? null : (
          <span className="text-xs text-muted-foreground tabular-nums">
            {amount}
          </span>
        )}
      </label>

      {item.manual ? (
        <form action={removeAction}>
          <input type="hidden" name="id" value={item.id} />
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            aria-label={`Togli ${item.name} dalla lista`}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </form>
      ) : null}
    </li>
  )
}
