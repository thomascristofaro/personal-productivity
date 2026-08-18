import { saveIngredient } from "@/app/(app)/ingredients/actions"
import { IngredientForm } from "@/components/ingredients/ingredient-form"
import { PageHeader } from "@/components/page/page-header"
import { AISLE_ORDER, AISLE_UNKNOWN } from "@/lib/aisles"
import { listUsedUnits } from "@/lib/services/catalog"

export const metadata = { title: "Nuovo ingrediente" }

export default async function NewIngredientPage() {
  const units = await listUsedUnits()

  return (
    <main className="flex flex-col gap-6 pt-6">
      <PageHeader
        title="Nuovo ingrediente"
        back={{ href: "/ingredients", label: "Ingredienti" }}
      />
      <IngredientForm
        action={saveIngredient}
        aisles={AISLE_ORDER}
        units={units}
        values={{ name: "", defaultUnit: "", aisle: AISLE_UNKNOWN }}
      />
    </main>
  )
}
