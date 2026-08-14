import { notFound } from "next/navigation"

import { saveRecipe } from "@/app/(app)/recipes/actions"
import { PageHeader } from "@/components/page/page-header"
import { RecipeForm } from "@/components/recipes/recipe-form"
import { getRecipe } from "@/lib/services/recipes"

export const metadata = { title: "Modifica ricetta" }

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const recipe = await getRecipe(id)

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
        values={{
          id: recipe.id,
          title: recipe.title,
          sourceUrl: recipe.sourceUrl ?? "",
          servings: recipe.servings?.toString() ?? "",
          totalMinutes: recipe.totalMinutes?.toString() ?? "",
          instructions: recipe.instructions ?? "",
          notes: recipe.notes ?? "",
          tags: recipe.tags.join(", "),
          ingredients: recipe.ingredients
            .map((ingredient) => ingredient.raw)
            .join("\n"),
        }}
      />
    </main>
  )
}
