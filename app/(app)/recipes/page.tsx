import Link from "next/link"
import { Suspense } from "react"

import { RecipeList } from "@/components/recipes/recipe-list"
import { RecipeSearch } from "@/components/recipes/recipe-search"
import { Button } from "@/components/ui/button"
import { listRecipes } from "@/lib/services/recipes"

export const metadata = { title: "Ricettario" }

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const recipes = await listRecipes(q)

  return (
    <main className="flex flex-col gap-4 pt-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Ricettario</h1>
        <Button render={<Link href="/recipes/new" />} nativeButton={false}>
          Nuova
        </Button>
      </div>

      <Suspense>
        <RecipeSearch />
      </Suspense>

      <RecipeList recipes={recipes} isSearching={Boolean(q?.trim())} />
    </main>
  )
}
