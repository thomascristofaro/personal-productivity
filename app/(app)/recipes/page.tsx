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
  // Next resolves a repeated `?q=` to a string array, not a string — the
  // param must be typed as Next actually delivers it, then normalised below.
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const { q: rawQuery } = await searchParams
  const q = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery
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
