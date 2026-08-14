import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

// Shaped to match lib/services/recipes's RecipeSummary structurally, without
// importing it: components/** may not import lib/services/** (architecture.md).
type RecipeSummary = {
  id: string
  title: string
  totalMinutes: number | null
  tags: string[]
}

function EmptyState({ isSearching }: { isSearching: boolean }) {
  return (
    <p className="py-12 text-center text-sm text-muted-foreground">
      {isSearching
        ? "Nessuna ricetta con questo nome."
        : "Non c'è ancora nessuna ricetta. Aggiungine una."}
    </p>
  )
}

export function RecipeList({
  recipes,
  isSearching,
}: {
  recipes: RecipeSummary[]
  isSearching: boolean
}) {
  if (recipes.length === 0) return <EmptyState isSearching={isSearching} />

  return (
    <ul className="flex flex-col gap-2">
      {recipes.map((recipe) => (
        <li key={recipe.id}>
          <Card className="p-0">
            <Link
              href={`/recipes/${recipe.id}`}
              className="flex min-h-14 flex-col justify-center gap-1 px-4 py-3"
            >
              <span className="font-medium">{recipe.title}</span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {recipe.totalMinutes === null ? null : (
                  <span>{recipe.totalMinutes} min</span>
                )}
                {recipe.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </span>
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  )
}
