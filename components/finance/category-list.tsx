"use client"

import { Pencil, Plus } from "lucide-react"
import { useState } from "react"

import { CardList } from "@/components/page/data-list"
import { DataListRow } from "@/components/page/data-list-row"
import { SelectField, TextField } from "@/components/page/fields"
import { FormDrawer } from "@/components/page/form-drawer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { useFormState } from "@/hooks/use-form-state"
import { countLabel } from "@/lib/count-label"
import type { FormAction } from "@/lib/form"
import {
  CATEGORY_KIND_LABELS,
  type CategoryKind,
} from "@/lib/schemas/finance"

export type CategoryRow = {
  id: string
  name: string
  kind: CategoryKind
  archived: boolean
  usedIn: number
}

// DOM order, so the first invalid field takes focus. Module-level: a fresh
// array on every render would re-run the hook's focus effect.
const FIELD_ORDER = ["name", "kind"] as const

const USED = { none: "mai usata", one: "movimento", many: "movimenti" }

// Editing one at a time, in a drawer, rather than a page per category: a
// category is a name and a kind, and a whole screen for two fields is a screen
// nobody wants to walk to.
export function CategoryList({
  categories,
  action,
}: {
  categories: CategoryRow[]
  action: FormAction
}) {
  const [editing, setEditing] = useState<CategoryRow | null>(null)
  const [adding, setAdding] = useState(false)

  const open = editing !== null || adding
  const form = useFormState(action, FIELD_ORDER, {
    name: editing?.name ?? "",
    kind: editing?.kind ?? "EXPENSE",
  })

  const close = (next: boolean) => {
    if (next) return
    setEditing(null)
    setAdding(false)
  }

  // The one TRANSFER category cannot become something else: confirming a pair
  // assigns it, and that dependency is two screens away — the kind of break
  // nobody would connect back to the rename that caused it.
  const isTransfer = editing?.kind === "TRANSFER"

  return (
    <>
      <CardList>
        {categories.map((category) => (
          <DataListRow
            key={category.id}
            title={
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 break-words">{category.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label={`Modifica la categoria ${category.name}`}
                  onClick={() => setEditing(category)}
                >
                  <Pencil aria-hidden="true" />
                </Button>
              </span>
            }
          >
            <Badge variant="secondary">
              {CATEGORY_KIND_LABELS[category.kind]}
            </Badge>
            <span>{countLabel(category.usedIn, USED).replace(".", "")}</span>
            {category.archived ? <span>archiviata</span> : null}
          </DataListRow>
        ))}
      </CardList>

      <Button
        variant="outline"
        className="self-start"
        onClick={() => setAdding(true)}
      >
        <Plus aria-hidden="true" />
        Nuova categoria
      </Button>

      <FormDrawer
        open={open}
        onOpenChange={close}
        form={form}
        title={editing === null ? "Nuova categoria" : editing.name}
        submitLabel="Salva"
        pendingLabel="Salvo…"
      >
        {editing === null ? null : (
          <input type="hidden" name="id" value={editing.id} />
        )}

        <TextField
          {...form.fieldProps("name")}
          label="Nome"
          error={form.errorOf("name")}
          autoComplete="off"
          required
        />

        {isTransfer ? (
          <>
            <input type="hidden" name="kind" value="TRANSFER" />
            <p className="text-sm text-muted-foreground">
              È la categoria dei trasferimenti fra i tuoi conti, e il tipo non
              si cambia: confermare una coppia la assegna.
            </p>
          </>
        ) : (
          <SelectField
            {...form.fieldProps("kind")}
            label="Tipo"
            error={form.errorOf("kind")}
            description="Decide se finisce nelle uscite o nelle entrate."
            options={{
              EXPENSE: CATEGORY_KIND_LABELS.EXPENSE,
              INCOME: CATEGORY_KIND_LABELS.INCOME,
            }}
          />
        )}

        {editing === null ? null : (
          <Field orientation="horizontal">
            <Checkbox
              id="archived"
              name="archived"
              value="1"
              defaultChecked={editing.archived}
            />
            <FieldLabel htmlFor="archived">
              Archivia: non compare più fra le scelte
            </FieldLabel>
          </Field>
        )}
      </FormDrawer>
    </>
  )
}
