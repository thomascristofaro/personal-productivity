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
  // Bumped after every add. The picker keeps the typed query in its own state,
  // which no prop can reach, so the only way to empty it is to remount it.
  const [pickerKey, setPickerKey] = useState(0)

  // React 19 clears the uncontrolled fields — here, the quantity — on its own
  // once the action resolves. Everything this form holds in state has to be put
  // back by hand, or the next item inherits the last one's aisle and its text
  // lands on top of the old name.
  const addThenReset = async (formData: FormData) => {
    await action(formData)
    setName("")
    setAisle(AISLE_UNKNOWN)
    setUnit("")
    setPickerKey((key) => key + 1)
  }

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
    <form action={addThenReset} className="flex flex-col gap-3 border-t pt-4">
      <input type="hidden" name="weekStart" value={weekStart} />
      <input type="hidden" name="name" value={name} />

      <Field>
        {/* The visible text and the picker's aria-label say the same thing on
            purpose: the combobox names itself, so a label reading something
            else would leave sighted and screen-reader users with two different
            names for one control. */}
        <FieldLabel htmlFor="item-name">Che cosa serve</FieldLabel>
        <IngredientPicker
          key={pickerKey}
          id="item-name"
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
            // Not `min={0}`: the schema rejects a quantity of zero, and the
            // action has no way to report it — so the browser must refuse it
            // here rather than letting the submit vanish without a word.
            min={0.01}
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
