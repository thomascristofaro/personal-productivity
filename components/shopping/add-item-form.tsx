"use client"

import { useState } from "react"

import { IngredientPicker } from "@/components/ingredients/ingredient-picker"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AISLE_UNKNOWN } from "@/lib/aisles"

export type CatalogueEntry = {
  name: string
  defaultUnit: string | null
  aisle: string
}

export function AddItemForm({
  weekStart,
  catalogue,
  aisles,
  action,
}: {
  weekStart: string
  catalogue: CatalogueEntry[]
  aisles: readonly string[]
  action: (formData: FormData) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [aisle, setAisle] = useState(AISLE_UNKNOWN)
  const [unit, setUnit] = useState("")

  // Picking a catalogue entry fills in what the catalogue already knows, so
  // "mele" lands in ortofrutta without anyone choosing it. Both stay editable:
  // this is a shopping line, not a change to the catalogue.
  const choose = (chosen: string) => {
    setName(chosen)
    const entry = catalogue.find((item) => item.name === chosen)
    if (entry === undefined) return
    setAisle(entry.aisle)
    setUnit(entry.defaultUnit ?? "")
  }

  return (
    <form action={action} className="flex flex-col gap-3 border-t pt-4">
      <input type="hidden" name="weekStart" value={weekStart} />
      <input type="hidden" name="name" value={name} />

      <Field>
        <FieldLabel>Aggiungi alla lista</FieldLabel>
        <IngredientPicker
          names={catalogue.map((entry) => entry.name)}
          value={name === "" ? null : name}
          onSelect={choose}
          // Free text that matches no catalogue entry is a legitimate shopping
          // line — "sacchetti" will never be an ingredient. Taking it here is
          // what keeps this form from becoming a way to pollute the catalogue.
          onCreate={setName}
          aria-label="Che cosa serve"
        />
      </Field>

      <div className="flex gap-2">
        <Field className="flex-1">
          <FieldLabel htmlFor="quantity">Quantità</FieldLabel>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            autoComplete="off"
          />
        </Field>

        <Field className="flex-1">
          <FieldLabel htmlFor="unit">Unità</FieldLabel>
          <Input
            id="unit"
            name="unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="aisle">Reparto</FieldLabel>
        {/* Base UI reports a cleared selection as null. There is no "no aisle"
            state here — the list sorts by it — so a clear falls back to the
            catch-all rather than leaving the field empty. */}
        <Select
          name="aisle"
          value={aisle}
          onValueChange={(next: string | null) =>
            setAisle(next ?? AISLE_UNKNOWN)
          }
        >
          <SelectTrigger id="aisle">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {aisles.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Button type="submit" disabled={name.trim() === ""}>
        Aggiungi
      </Button>
    </form>
  )
}
