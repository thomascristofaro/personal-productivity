import Link from "next/link"
import { Suspense } from "react"

import { DataList } from "@/components/page/data-list"
import { EmptyState } from "@/components/page/empty-state"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { SearchField } from "@/components/page/search-field"
import { RecipeRow } from "@/components/recipes/recipe-row"
import { Button } from "@/components/ui/button"
import { firstOf } from "@/lib/search-params"
import { listRecipes } from "@/lib/services/recipes"

export const metadata = { title: "Ricettario" }

function announce(count: number) {
  if (count === 0) return "Nessuna ricetta trovata."
  return count === 1 ? "1 ricetta trovata." : `${count} ricette trovate.`
}

export default async function RecipesPage({
  searchParams,
}: {
  // Next resolves a repeated `?q=` to a string array, not a string — the
  // param must be typed as Next actually delivers it, then normalised below.
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const { q: rawQuery } = await searchParams
  const q = firstOf(rawQuery)
  const isSearching = Boolean(q?.trim())
  const recipes = await listRecipes(q)

  return (
    <ListBody>
      <PageHeader title="Ricettario">
        <Button render={<Link href="/recipes/new" />} nativeButton={false}>
          Nuova
        </Button>
      </PageHeader>

      <Suspense>
        <SearchField
          basePath="/recipes"
          placeholder="Cerca una ricetta…"
          label="Cerca una ricetta"
        />
      </Suspense>

      <DataList
        items={recipes}
        announcement={announce(recipes.length)}
        renderItem={(recipe) => <RecipeRow key={recipe.id} recipe={recipe} />}
        empty={
          isSearching ? (
            <EmptyState title="Nessuna ricetta con questo nome." />
          ) : (
            <EmptyState
              title="Non c’è ancora nessuna ricetta."
              description="Aggiungi la prima e comincia il ricettario."
            >
              <Button
                render={<Link href="/recipes/new" />}
                nativeButton={false}
              >
                Nuova ricetta
              </Button>
            </EmptyState>
          )
        }
      />
    </ListBody>
  )
}
