import { DataListRow } from "@/components/page/data-list-row"
import { Badge } from "@/components/ui/badge"

// Shaped to match lib/services/recipes's RecipeSummary structurally, without
// importing it: components/** may not import lib/services/** (architecture.md).
// The service type carries `servings` too; a wider object satisfies this one.
type RecipeSummary = {
  id: string
  title: string
  totalMinutes: number | null
  tags: string[]
}

export function RecipeRow({ recipe }: { recipe: RecipeSummary }) {
  return (
    <DataListRow href={`/recipes/${recipe.id}`} title={recipe.title}>
      {recipe.totalMinutes === null ? null : (
        <span>{recipe.totalMinutes} min</span>
      )}
      {recipe.tags.map((tag) => (
        <Badge key={tag} variant="secondary">
          {tag}
        </Badge>
      ))}
    </DataListRow>
  )
}
