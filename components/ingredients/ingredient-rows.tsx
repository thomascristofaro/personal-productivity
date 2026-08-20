"use client"

import { Trash2 } from "lucide-react"
import { useRef, useState } from "react"

import {
  IngredientPicker,
  type IngredientOption,
} from "@/components/ingredients/ingredient-picker"
import { UnitInput } from "@/components/ingredients/unit-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { countLabel } from "@/lib/count-label"

export type IngredientRowValue = {
  key: string
  ingredientName: string
  unit: string
  quantity: string
}

const UNIT_LIST_ID = "unit-suggestions"

// Zero never renders: the last row's bin is disabled. Spelled out anyway, so
// this count has the same shape as every other one in the app.
const ROW_COUNT = {
  none: "Nessun ingrediente.",
  one: "ingrediente",
  many: "ingredienti",
}

export function emptyIngredientRow(key: string): IngredientRowValue {
  return { key, ingredientName: "", unit: "", quantity: "" }
}

export function IngredientRows({
  options,
  units,
  defaultRows,
  onCreateIngredient,
}: {
  options: IngredientOption[]
  units: string[]
  defaultRows: IngredientRowValue[]
  onCreateIngredient: (name: string) => Promise<IngredientOption | null>
}) {
  const [rows, setRows] = useState<IngredientRowValue[]>(
    defaultRows.length > 0 ? defaultRows : [emptyIngredientRow("row-0")]
  )
  // Keys are minted here rather than taken from the index, so removing a middle
  // row does not make React reuse the wrong input's DOM state.
  const nextKey = useRef(rows.length)
  const quantityRefs = useRef(new Map<string, HTMLInputElement | null>())

  const names = options.map((option) => option.name)

  function fill(key: string, name: string, defaultUnit: string | null) {
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row
        // Only pre-fill an empty unit: overwriting a unit the user just typed
        // would undo a deliberate choice.
        const unit =
          row.unit === "" && defaultUnit !== null ? defaultUnit : row.unit
        return { ...row, ingredientName: name, unit }
      })
    )
    quantityRefs.current.get(key)?.focus()
  }

  function select(key: string, name: string) {
    const option = options.find((candidate) => candidate.name === name)
    fill(key, name, option?.defaultUnit ?? null)
  }

  async function create(key: string, name: string) {
    const created = await onCreateIngredient(name)
    if (created !== null) fill(key, created.name, created.defaultUnit)
  }

  const update = (key: string, patch: Partial<IngredientRowValue>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row))
    )

  return (
    <div className="flex flex-col gap-2">
      {/* One shared list for every row, so the browser parses it once. */}
      <datalist id={UNIT_LIST_ID}>
        {units.map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>

      {/* The picker takes a whole line of its own until there is room for all
          four controls side by side. Sharing 390px between them left every
          placeholder clipped — "Unit:", "Cerca un in" — once the style moved to
          taller inputs with more padding. */}
      {rows.map((row, index) => (
        <div key={row.key} className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
            <IngredientPicker
              names={names}
              value={row.ingredientName === "" ? null : row.ingredientName}
              onSelect={(name) => select(row.key, name)}
              onCreate={(name) => void create(row.key, name)}
              aria-label={`Ingrediente ${index + 1}`}
            />
            <input
              type="hidden"
              name="ingredientName"
              value={row.ingredientName}
            />
          </div>

          <div className="w-24 shrink-0">
            <UnitInput
              name="unit"
              value={row.unit}
              onChange={(unit) => update(row.key, { unit })}
              listId={UNIT_LIST_ID}
              aria-label={`Unità dell’ingrediente ${index + 1}`}
            />
          </div>

          <div className="w-24 shrink-0">
            <Input
              name="quantity"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={row.quantity}
              onChange={(event) =>
                update(row.key, { quantity: event.target.value })
              }
              ref={(element) => {
                quantityRefs.current.set(row.key, element)
              }}
              aria-label={`Quantità dell’ingrediente ${index + 1}`}
              placeholder="Qtà"
              autoComplete="off"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Togli l’ingrediente ${index + 1}`}
            // The schema needs at least one row, and a form that can reach an
            // unsubmittable state is a trap.
            disabled={rows.length === 1}
            onClick={() =>
              setRows((current) =>
                current.filter((candidate) => candidate.key !== row.key)
              )
            }
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      ))}

      <span role="status" aria-live="polite" className="sr-only">
        {countLabel(rows.length, ROW_COUNT)}
      </span>

      {/* An explicit button rather than a ghost row that appears on typing: on
          a phone a ghost row gets created by a stray touch. */}
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() =>
          setRows((current) => {
            nextKey.current += 1
            return [...current, emptyIngredientRow(`row-${nextKey.current}`)]
          })
        }
      >
        Aggiungi ingrediente
      </Button>
    </div>
  )
}
