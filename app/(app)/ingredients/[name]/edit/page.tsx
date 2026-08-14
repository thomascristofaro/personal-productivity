import { notFound } from "next/navigation"

import {
  removeIngredient,
  saveIngredient,
} from "@/app/(app)/ingredients/actions"
import { IngredientForm } from "@/components/ingredients/ingredient-form"
import { PageHeader } from "@/components/page/page-header"
import { Button } from "@/components/ui/button"
import { AISLE_ORDER } from "@/lib/aisles"
import { getIngredient, listUsedUnits } from "@/lib/services/ingredients"

export const metadata = { title: "Modifica ingrediente" }

export default async function EditIngredientPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  // Next decodes the segment, so this is the plain name again.
  const { name } = await params
  const [ingredient, units] = await Promise.all([
    getIngredient(name),
    listUsedUnits(),
  ])

  if (ingredient === null) notFound()

  return (
    <main className="flex flex-col gap-6 pt-6">
      <PageHeader
        title="Modifica ingrediente"
        back={{ href: "/ingredients", label: "Ingredienti" }}
      />

      <IngredientForm
        action={saveIngredient}
        aisles={AISLE_ORDER}
        units={units}
        values={{
          originalName: ingredient.name,
          name: ingredient.name,
          defaultUnit: ingredient.defaultUnit ?? "",
          aisle: ingredient.aisle,
        }}
      />

      {ingredient.usedIn === 0 ? (
        <form action={removeIngredient.bind(null, ingredient.name)}>
          <Button type="submit" variant="destructive">
            Elimina
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">
          Non si può eliminare: è usato in{" "}
          {ingredient.usedIn === 1
            ? "1 ricetta"
            : `${ingredient.usedIn} ricette`}
          .
        </p>
      )}
    </main>
  )
}
