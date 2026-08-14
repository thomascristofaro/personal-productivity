"use client"

import { useActionState, useEffect, useState } from "react"

import {
  RecipePicker,
  type RecipeOption,
} from "@/components/menu/recipe-picker"
import { Button } from "@/components/ui/button"
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

export type SlotFormState = { message: string | null; ok: boolean }

export type SaveSlotAction = (
  state: SlotFormState,
  formData: FormData
) => Promise<SlotFormState>

export const EMPTY_SLOT_FORM_STATE: SlotFormState = { message: null, ok: false }

export type SlotDrawerValues = {
  day: number
  meal: "LUNCH" | "DINNER"
  recipeId: string | null
  recipeTitle: string | null
  freeText: string | null
  servings: number | null
}

export function SlotDrawer({
  open,
  onClose,
  slot,
  weekStart,
  dayLabel,
  recipes,
  saveAction,
  clearAction,
}: {
  open: boolean
  // Must be a stable reference — see the effect below. The parent creates it
  // with useCallback.
  onClose: () => void
  slot: SlotDrawerValues
  weekStart: string
  dayLabel: string
  recipes: RecipeOption[]
  saveAction: SaveSlotAction
  clearAction: (formData: FormData) => Promise<void>
}) {
  const [state, formAction, isPending] = useActionState(
    saveAction,
    EMPTY_SLOT_FORM_STATE
  )
  const [picked, setPicked] = useState<RecipeOption | null>(
    slot.recipeId === null || slot.recipeTitle === null
      ? null
      : { id: slot.recipeId, title: slot.recipeTitle }
  )

  // useActionState hands back a fresh object on every submit, so this fires
  // once per successful save and not again when the drawer is reopened —
  // provided `onClose` keeps its identity between renders.
  useEffect(() => {
    if (state.ok) onClose()
  }, [state, onClose])

  const mealLabel = slot.meal === "LUNCH" ? "Pranzo" : "Cena"

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {dayLabel} · {mealLabel}
          </DrawerTitle>
          <DrawerDescription>
            Scegli una ricetta, oppure scrivi una nota per un pasto che non si
            cucina.
          </DrawerDescription>
        </DrawerHeader>

        <form action={formAction} className="flex flex-col gap-6 px-4">
          <input type="hidden" name="weekStart" value={weekStart} />
          <input type="hidden" name="day" value={slot.day} />
          <input type="hidden" name="meal" value={slot.meal} />
          <input type="hidden" name="recipeId" value={picked?.id ?? ""} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="recipe">Ricetta</FieldLabel>
              <RecipePicker
                id="recipe"
                recipes={recipes}
                value={picked}
                onSelect={setPicked}
                aria-describedby="recipe-description"
              />
              <FieldDescription id="recipe-description">
                Scrivi per filtrare il ricettario.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="freeText">Oppure una nota</FieldLabel>
              <Input
                id="freeText"
                name="freeText"
                defaultValue={slot.freeText ?? ""}
                autoComplete="off"
                placeholder="fuori a cena…"
                aria-describedby="freeText-description"
              />
              <FieldDescription id="freeText-description">
                Una nota non finisce nella lista della spesa.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="servings">Porzioni</FieldLabel>
              <Input
                id="servings"
                name="servings"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                defaultValue={slot.servings ?? ""}
                autoComplete="off"
                aria-describedby="servings-description"
              />
              <FieldDescription id="servings-description">
                Lascia vuoto per le porzioni di casa.
              </FieldDescription>
            </Field>
          </FieldGroup>

          {state.message === null ? null : (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}

          <DrawerFooter className="px-0">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvo…" : "Salva"}
            </Button>
          </DrawerFooter>
        </form>

        {/* A second form, a sibling and not a child: a form inside a form is
            invalid HTML and the browser drops the inner one. */}
        <form action={clearAction} className="px-4 pb-4">
          <input type="hidden" name="weekStart" value={weekStart} />
          <input type="hidden" name="day" value={slot.day} />
          <input type="hidden" name="meal" value={slot.meal} />
          <Button type="submit" variant="outline" className="w-full">
            Svuota
          </Button>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
