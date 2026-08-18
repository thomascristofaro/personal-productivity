"use client"

import { Plus } from "lucide-react"
import { useActionState, useState } from "react"

import { IngredientPicker } from "@/components/ingredients/ingredient-picker"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AISLE_UNKNOWN } from "@/lib/aisles"
import { cn } from "@/lib/utils"

export type CatalogEntry = {
  name: string
  defaultUnit: string | null
  aisle: string
}

export type AddItemState = { ok: boolean; message: string | null }

export type AddItemAction = (
  state: AddItemState,
  formData: FormData
) => Promise<AddItemState>

export const EMPTY_ADD_ITEM_STATE: AddItemState = { ok: false, message: null }

// Base UI's Select.Value renders the raw value unless the root is given this
// map. English values because they are what the database holds, Italian labels
// because they are what the user reads.
const KIND_LABELS: Record<string, string> = {
  INGREDIENT: "Ingrediente",
  PRODUCT: "Prodotto",
}

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
  action: AddItemAction
  // The completion bar is fixed across the same corner. When it is showing the
  // button lifts above it rather than sitting on top of it.
  aboveBar: boolean
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(
    action,
    EMPTY_ADD_ITEM_STATE
  )
  const [name, setName] = useState("")
  const [aisle, setAisle] = useState(AISLE_UNKNOWN)
  const [unit, setUnit] = useState("")

  // The same trick as hooks/use-attempt.ts, for the same two reasons. Bumping
  // `attempt` remounts the uncontrolled fields, so React 19's form reset cannot
  // fight a value put back by hand. And this runs during render rather than in
  // an effect: React re-runs the component before committing, so the drawer
  // never paints open after a successful add. An effect here would be a
  // cascading render, which is what react-hooks/set-state-in-effect objects to.
  const [seen, setSeen] = useState(state)
  const [attempt, setAttempt] = useState(0)

  if (seen !== state) {
    setSeen(state)
    setAttempt((count) => count + 1)
    if (state.ok) {
      setOpen(false)
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
    const entry = catalog.find((item) => item.name === chosen)
    if (entry === undefined) return
    setAisle(entry.aisle)
    setUnit(entry.defaultUnit ?? "")
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
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

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Aggiungi alla lista</DrawerTitle>
          <DrawerDescription>
            Qualsiasi cosa: un ingrediente, lo shampoo, i sacchetti.
          </DrawerDescription>
        </DrawerHeader>

        <form action={formAction} className="flex flex-col gap-6 px-4">
          <input type="hidden" name="weekStart" value={weekStart} />
          <input type="hidden" name="name" value={name} />

          <FieldGroup key={attempt}>
            <Field>
              {/* The visible text and the picker's aria-label say the same
                  thing on purpose: the combobox names itself, so a label
                  reading something else would leave sighted and screen-reader
                  users with two different names for one control. */}
              <FieldLabel htmlFor="item-name">Che cosa serve</FieldLabel>
              {/* The picker keeps the typed query in its own state, which no
                  prop can reach. It empties because the FieldGroup above is
                  keyed on `attempt` and remounts the whole group. */}
              <IngredientPicker
                id="item-name"
                names={catalog.map((entry) => entry.name)}
                value={name === "" ? null : name}
                onSelect={choose}
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
                  // Not min={0}: the schema rejects a quantity of zero, and the
                  // browser can refuse it before the drawer has to explain it.
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
              {/* Base UI reports a cleared selection as null. There is no "no
                  aisle" state here — the list sorts by it — so a clear falls
                  back to the catch-all rather than leaving the field empty. */}
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

            {/* Only for a name the catalogue does not hold. On one it already
                has there is nothing to decide, and two fields asking anyway is
                how a drawer stops being quick. */}
            {isNew ? (
              <>
                <Field>
                  <FieldLabel htmlFor="kind">Tipo</FieldLabel>
                  <Select
                    name="kind"
                    defaultValue="PRODUCT"
                    items={KIND_LABELS}
                  >
                    <SelectTrigger id="kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(KIND_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription id="kind-description">
                    Prodotto di default: quello che si cucina di solito nasce
                    dalla ricetta.
                  </FieldDescription>
                </Field>

                <Field orientation="horizontal">
                  <Checkbox id="skipCatalog" name="skipCatalog" value="1" />
                  <FieldLabel htmlFor="skipCatalog">
                    Non salvare nel catalogo
                  </FieldLabel>
                </Field>
              </>
            ) : null}
          </FieldGroup>

          {state.message === null ? null : (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}

          <DrawerFooter className="px-0">
            <Button type="submit" disabled={isPending || name.trim() === ""}>
              {isPending ? "Aggiungo…" : "Aggiungi"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
