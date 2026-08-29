"use client"

import { Plus } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { IngredientPicker } from "@/components/ingredients/ingredient-picker"
import { NumberField, SelectField, TextField } from "@/components/page/fields"
import { FormDrawer } from "@/components/page/form-drawer"
import { FormField } from "@/components/page/form-field"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { useFormState } from "@/hooks/use-form-state"
import { AISLE_UNKNOWN } from "@/lib/aisles"
import type { FormAction } from "@/lib/form"
import { cn } from "@/lib/utils"

export type CatalogEntry = {
  name: string
  defaultUnit: string | null
  aisle: string
}

// Base UI's Select.Value renders the raw value unless the root is given this
// map. English values because they are what the database holds, Italian labels
// because they are what the user reads.
const KIND_LABELS: Record<string, string> = {
  INGREDIENT: "Ingrediente",
  PRODUCT: "Prodotto",
}

const FIELD_ORDER = ["quantity", "unit", "aisle", "kind"] as const

export function AddItemDrawer({
  weekStart,
  catalog,
  aisles,
  action,
  aboveBar,
}: {
  weekStart: string
  catalog: CatalogEntry[]
  aisles: readonly string[]
  action: FormAction
  // The completion bar is fixed across the same corner. When it is showing the
  // button lifts above it rather than sitting on top of it.
  aboveBar: boolean
}) {
  const [open, setOpen] = useState(false)
  // «Prodotto» as the initial value rather than a `defaultValue` on the field:
  // fieldProps already emits one, and whichever is spread second wins. Written
  // as a prop it either sat after the spread and made the echo inert, or sat
  // before it and lost to the empty string fieldProps falls back to.
  const form = useFormState(action, FIELD_ORDER, { kind: "PRODUCT" })
  const [name, setName] = useState("")
  const [aisle, setAisle] = useState(AISLE_UNKNOWN)
  const [unit, setUnit] = useState("")
  const quantity = useRef<HTMLInputElement>(null)
  // Counts settled names rather than holding one: choosing the same name twice
  // still has to move the focus, and a value would not change.
  const [named, setNamed] = useState(0)

  // Naming the thing is the whole question this drawer asks; what follows is
  // how much of it. The number is what gets typed next, so go there — and
  // select what is there, so a second thought overwrites rather than appends.
  useEffect(() => {
    if (named === 0) return
    // Deferred: Base UI puts the focus back on the combobox input when the
    // popup closes, which happens after this handler and would win the race.
    const timer = setTimeout(() => {
      quantity.current?.focus()
      quantity.current?.select()
    }, 0)
    return () => clearTimeout(timer)
  }, [named])

  // FormDrawer closes itself on a successful save, but it knows nothing of
  // `name`, `aisle` and `unit` — they live here. Adjusting them during render
  // is legal because every setter below belongs to this component: React
  // reruns a component that updates its own state mid-render, so a fresh
  // `attempt` never paints with stale local state. It would not be legal to
  // reach into a different component's state this way — that produces
  // "Cannot update a component while rendering a different component".
  const [seen, setSeen] = useState(form.attempt)
  if (seen !== form.attempt) {
    setSeen(form.attempt)
    if (form.state.ok) {
      setName("")
      setAisle(AISLE_UNKNOWN)
      setUnit("")
    }
  }

  // Case-insensitively, because the name is lowercased server-side and the
  // catalogue is all lowercase: typing "Shampoo" must not offer to create a
  // second entry for one that already exists.
  const typed = name.trim().toLowerCase()
  const isNew =
    typed.length > 0 && !catalog.some((entry) => entry.name === typed)

  // Picking a catalogue entry fills in what the catalogue already knows, so
  // "mele" lands in ortofrutta without anyone choosing it. Both stay editable:
  // this is a shopping line, not a change to the catalogue.
  const choose = (chosen: string) => {
    setName(chosen)
    setNamed((count) => count + 1)
    const entry = catalog.find((item) => item.name === chosen)
    if (entry === undefined) return
    setAisle(entry.aisle)
    setUnit(entry.defaultUnit ?? "")
  }

  // A name the catalogue does not hold brings nothing with it, but it settles
  // the same question, so the focus moves the same way.
  const create = (typed: string) => {
    setName(typed)
    setNamed((count) => count + 1)
  }

  return (
    <>
      {/* Floating, bottom right, over the list rather than in the header: it is
          the thing you reach for most while walking the shop, and the thumb is
          already down there. The inset keeps it off the home indicator once the
          app is installed to the home screen. */}
      <Button
        size="icon"
        aria-label="Aggiungi alla lista"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed right-4 z-40 size-14 rounded-full shadow-lg",
          aboveBar
            ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"
            : "bottom-[calc(1rem+env(safe-area-inset-bottom))]"
        )}
      >
        <Plus aria-hidden="true" className="size-6" />
      </Button>

      <FormDrawer
        open={open}
        onOpenChange={setOpen}
        form={form}
        title="Aggiungi alla lista"
        description="Qualsiasi cosa: un ingrediente, lo shampoo, i sacchetti."
        submitLabel="Aggiungi"
        pendingLabel="Aggiungo…"
        submitDisabled={name.trim() === ""}
      >
        <input type="hidden" name="weekStart" value={weekStart} />
        <input type="hidden" name="name" value={name} />

        {/* The visible text and the picker's aria-label say the same thing on
            purpose: the combobox names itself, so a label reading something
            else would leave sighted and screen-reader users with two
            different names for one control. */}
        <FormField name="item-name" label="Che cosa serve">
          {/* The picker keeps the typed query in its own state, which no prop
              can reach. It empties because FormDrawer keys the field group on
              `form.attempt` and remounts the whole group. */}
          <IngredientPicker
            id="item-name"
            names={catalog.map((entry) => entry.name)}
            value={name === "" ? null : name}
            onSelect={choose}
            onCreate={create}
            aria-label="Che cosa serve"
          />
        </FormField>

        {/* Not two equal halves: identical fields side by side is why the
            number kept being typed into the unit. The number is the one being
            filled in, so it gets the room. */}
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <NumberField
              {...form.fieldProps("quantity")}
              ref={quantity}
              label="Quantità"
              error={form.errorOf("quantity")}
              // Not min={0}: the schema rejects a quantity of zero, and the
              // browser can refuse it before the drawer has to explain it.
              min={0.01}
              step="any"
              inputMode="decimal"
              autoComplete="off"
            />
          </div>
          <div className="w-24 shrink-0">
            <TextField
              {...form.fieldProps("unit", { controlled: true })}
              label="Unità"
              error={form.errorOf("unit")}
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        <SelectField
          {...form.fieldProps("aisle", { controlled: true })}
          label="Reparto"
          error={form.errorOf("aisle")}
          options={aisles}
          value={aisle}
          // Base UI reports a cleared selection as null. There is no "no
          // aisle" state here — the list sorts by it — so a clear falls back
          // to the catch-all.
          onValueChange={(next: string | null) =>
            setAisle(next ?? AISLE_UNKNOWN)
          }
        />

        {/* Only for a name the catalogue does not hold. On one it already has
            there is nothing to decide, and two fields asking anyway is how a
            drawer stops being quick. */}
        {isNew ? (
          <>
            <SelectField
              {...form.fieldProps("kind")}
              label="Tipo"
              error={form.errorOf("kind")}
              description="Prodotto di default: quello che si cucina di solito nasce dalla ricetta."
              options={KIND_LABELS}
            />
            <Field orientation="horizontal">
              <Checkbox id="skipCatalog" name="skipCatalog" value="1" />
              <FieldLabel htmlFor="skipCatalog">
                Non salvare nel catalogo
              </FieldLabel>
            </Field>
          </>
        ) : null}
      </FormDrawer>
    </>
  )
}
