import { notFound } from "next/navigation"

import { addIngredient, saveRecipe } from "@/app/(app)/recipes/actions"
import { PageHeader } from "@/components/page/page-header"
import { RecipeForm } from "@/components/recipes/recipe-form"
import { listIngredientOptions, listUsedUnits } from "@/lib/services/catalog"
import { getRecipe, listTags } from "@/lib/services/recipes"

export const metadata = { title: "Modifica ricetta" }

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // In parallel: awaiting them in sequence is the waterfall the React
  // guidelines rank CRITICAL.
  const [recipe, options, units, tagSuggestions] = await Promise.all([
    getRecipe(id),
    listIngredientOptions(),
    listUsedUnits(),
    listTags(),
  ])

  if (recipe === null) notFound()

  return (
    <main className="flex flex-col gap-6 pt-6">
      {/* Labelled with the recipe's own title, so the link names where it goes. */}
      <PageHeader
        title="Modifica ricetta"
        back={{ href: `/recipes/${recipe.id}`, label: recipe.title }}
      />
      <RecipeForm
        action={saveRecipe}
        options={options}
        units={units}
        tagSuggestions={tagSuggestions}
        onCreateIngredient={addIngredient}
        values={{
          id: recipe.id,
          title: recipe.title,
          sourceUrl: recipe.sourceUrl ?? "",
          servings: recipe.servings?.toString() ?? "",
          totalMinutes: recipe.totalMinutes?.toString() ?? "",
          instructions: recipe.instructions ?? "",
          notes: recipe.notes ?? "",
          tags: recipe.tags,
          ingredients: recipe.ingredients.map((ingredient) => ({
            key: ingredient.id,
            ingredientName: ingredient.ingredientName,
            unit: ingredient.unit ?? "",
            quantity: ingredient.quantity?.toString() ?? "",
          })),
        }}
      />
    </main>
  )
}
