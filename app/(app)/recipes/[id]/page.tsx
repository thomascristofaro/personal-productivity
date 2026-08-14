import Link from "next/link"
import { notFound } from "next/navigation"
import { cache } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { getRecipe } from "@/lib/services/recipes"

// generateMetadata and the page both need the recipe; React.cache collapses
// them into one query per request. The service cannot do this itself — the
// domain layer may not import React.
const recipeOnce = cache(getRecipe)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const recipe = await recipeOnce(id)
  return { title: recipe?.title ?? "Ricetta" }
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const recipe = await recipeOnce(id)

  if (recipe === null) notFound()

  return (
    <main className="flex flex-col gap-6 pt-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">{recipe.title}</h1>

        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {recipe.servings === null ? null : <span>per {recipe.servings}</span>}
          {recipe.totalMinutes === null ? null : (
            <span>{recipe.totalMinutes} min</span>
          )}
          {recipe.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            render={<Link href={`/recipes/${recipe.id}/edit`} />}
            nativeButton={false}
          >
            Modifica
          </Button>
          {recipe.sourceUrl === null ? null : (
            <Button
              variant="ghost"
              render={
                <a
                  href={recipe.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                />
              }
              nativeButton={false}
            >
              Apri la fonte
            </Button>
          )}
        </div>
      </header>

      <Separator />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Ingredienti</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {recipe.ingredients.map((ingredient) => (
            <li key={ingredient.id}>{ingredient.raw}</li>
          ))}
        </ul>
      </section>

      {recipe.instructions === null ? null : (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Preparazione</h2>
          <p className="text-sm whitespace-pre-wrap">{recipe.instructions}</p>
        </section>
      )}

      {recipe.notes === null ? null : (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Note</h2>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {recipe.notes}
          </p>
        </section>
      )}
    </main>
  )
}
