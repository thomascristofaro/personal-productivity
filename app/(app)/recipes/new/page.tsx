import { saveRecipe } from "@/app/(app)/recipes/actions"
import { PageHeader } from "@/components/page/page-header"
import { RecipeForm } from "@/components/recipes/recipe-form"

export const metadata = { title: "Nuova ricetta" }

export default function NewRecipePage() {
  return (
    <main className="flex flex-col gap-6 pt-6">
      <PageHeader
        title="Nuova ricetta"
        back={{ href: "/recipes", label: "Ricettario" }}
      />
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
