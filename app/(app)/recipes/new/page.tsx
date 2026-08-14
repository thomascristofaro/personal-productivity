import { saveRecipe } from "@/app/(app)/recipes/actions"
import { RecipeForm } from "@/components/recipes/recipe-form"

export const metadata = { title: "Nuova ricetta" }

export default function NewRecipePage() {
  return (
    <main className="flex flex-col gap-6 pt-6">
      <h1 className="text-xl font-semibold">Nuova ricetta</h1>
      <RecipeForm
        action={saveRecipe}
        values={{
          title: "",
          sourceUrl: "",
          servings: "",
          totalMinutes: "",
          instructions: "",
          notes: "",
          tags: "",
          ingredients: "",
        }}
      />
    </main>
  )
}
