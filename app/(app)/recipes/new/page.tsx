import { addIngredient, saveRecipe } from "@/app/(app)/recipes/actions"
import { PageHeader } from "@/components/page/page-header"
import { RecipeForm } from "@/components/recipes/recipe-form"
import { listIngredients, listUsedUnits } from "@/lib/services/ingredients"
import { listTags } from "@/lib/services/recipes"

export const metadata = { title: "Nuova ricetta" }

export default async function NewRecipePage() {
  // In parallel: awaiting them in sequence is the waterfall the React
  // guidelines rank CRITICAL.
  const [options, units, tagSuggestions] = await Promise.all([
    listIngredients(),
    listUsedUnits(),
    listTags(),
  ])

  return (
    <main className="flex flex-col gap-6 pt-6">
      <PageHeader
        title="Nuova ricetta"
        back={{ href: "/recipes", label: "Ricettario" }}
      />
      <RecipeForm
        action={saveRecipe}
        options={options}
        units={units}
        tagSuggestions={tagSuggestions}
        onCreateIngredient={addIngredient}
        values={{
          title: "",
          sourceUrl: "",
          servings: "",
          totalMinutes: "",
          instructions: "",
          notes: "",
          tags: [],
          ingredients: [],
        }}
      />
    </main>
  )
}
