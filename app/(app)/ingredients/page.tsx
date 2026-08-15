import Link from "next/link"

import { DataList } from "@/components/page/data-list"
import { DataListRow } from "@/components/page/data-list-row"
import { EmptyState } from "@/components/page/empty-state"
import { PageHeader } from "@/components/page/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { listIngredientsWithUsage } from "@/lib/services/ingredients"

export const metadata = { title: "Ingredienti" }

function announce(count: number) {
  if (count === 0) return "Nessun ingrediente trovato."
  return count === 1
    ? "1 ingrediente trovato."
    : `${count} ingredienti trovati.`
}

export default async function IngredientsPage({
  searchParams,
}: {
  // Next resolves a repeated `?q=` to a string array, not a string.
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const { q: rawQuery } = await searchParams
  const q = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery
  const isSearching = Boolean(q?.trim())
  const ingredients = await listIngredientsWithUsage(q)

  return (
    <main className="flex flex-col gap-4 pt-6">
      <PageHeader title="Ingredienti">
        <Button render={<Link href="/ingredients/new" />} nativeButton={false}>
          Nuovo
        </Button>
      </PageHeader>

      <DataList
        items={ingredients}
        announcement={announce(ingredients.length)}
        renderItem={(ingredient) => (
          <DataListRow
            key={ingredient.name}
            href={`/ingredients/${encodeURIComponent(ingredient.name)}/edit`}
            title={ingredient.name}
          >
            <Badge variant="secondary">{ingredient.aisle}</Badge>
            {ingredient.defaultUnit === null ? null : (
              <span>{ingredient.defaultUnit}</span>
            )}
            <span>
              {ingredient.usedIn === 0
                ? "non usato"
                : ingredient.usedIn === 1
                  ? "1 ricetta"
                  : `${ingredient.usedIn} ricette`}
            </span>
          </DataListRow>
        )}
        empty={
          isSearching ? (
            <EmptyState title="Nessun ingrediente con questo nome." />
          ) : (
            <EmptyState
              title="Il catalogo è vuoto."
              description="Aggiungi il primo ingrediente."
            >
              <Button
                render={<Link href="/ingredients/new" />}
                nativeButton={false}
              >
                Nuovo ingrediente
              </Button>
            </EmptyState>
          )
        }
      />
    </main>
  )
}
