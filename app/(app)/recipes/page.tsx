import Link from "next/link"
import { Suspense } from "react"

import { DataList } from "@/components/page/data-list"
import { DataListRow } from "@/components/page/data-list-row"
import { EmptyState } from "@/components/page/empty-state"
import { ListBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { SearchField } from "@/components/page/search-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { countLabel } from "@/lib/count-label"
import { firstOf } from "@/lib/search-params"
import { listRecipes } from "@/lib/services/recipes"

export const metadata = { title: "Ricettario" }

const FOUND = {
  none: "Nessuna ricetta trovata.",
  one: "ricetta trovata",
  many: "ricette trovate",
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
        announcement={countLabel(recipes.length, FOUND)}
        renderItem={(recipe) => (
          <DataListRow
            key={recipe.id}
            href={`/recipes/${recipe.id}`}
            title={recipe.title}
          >
            {recipe.totalMinutes === null ? null : (
              <span>{recipe.totalMinutes} min</span>
            )}
            {recipe.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </DataListRow>
        )}
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
