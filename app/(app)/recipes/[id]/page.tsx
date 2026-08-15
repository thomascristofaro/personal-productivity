import Link from "next/link"
import { notFound } from "next/navigation"
import { cache } from "react"

import { removeRecipe } from "@/app/(app)/recipes/actions"
import { PageHeader } from "@/components/page/page-header"
import { DeleteRecipeDialog } from "@/components/recipes/delete-recipe-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { getRecipe } from "@/lib/services/recipes"
import { amountOf } from "@/lib/units"

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
      <div className="flex flex-col gap-3">
        <PageHeader
          title={recipe.title}
          back={{ href: "/recipes", label: "Ricettario" }}
        />

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

        {/* A toolbar below the header rather than in PageHeader's action
            slot: at 390px three buttons do not fit beside a recipe title. */}
        <div className="flex flex-wrap gap-2">
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
          <DeleteRecipeDialog
            id={recipe.id}
            title={recipe.title}
            action={removeRecipe}
          />
        </div>
      </div>

      <Separator />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Ingredienti</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {recipe.ingredients.map((ingredient) => (
            <li key={ingredient.id}>
              {/* An ingredient with no quantity renders as just its name,
                  which is the "q.b." case reading correctly. */}
              {[
                amountOf(ingredient.quantity, ingredient.unit),
                ingredient.ingredientName,
              ]
                .filter((part) => part !== null && part !== "")
                .join(" ")}
            </li>
          ))}
        </ul>
      </section>

      {recipe.instructions === null ? null : (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Preparazione</h2>
          <p className="text-base leading-relaxed break-words whitespace-pre-wrap">
            {recipe.instructions}
          </p>
        </section>
      )}
    </main>
  )
}
