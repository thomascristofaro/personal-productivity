import { addIngredient, saveRecipe } from "@/app/(app)/recipes/actions"
import { TextField } from "@/components/page/fields"
import { DetailBody } from "@/components/page/page-body"
import { PageHeader } from "@/components/page/page-header"
import { RecipeForm } from "@/components/recipes/recipe-form"
import { Button } from "@/components/ui/button"
import { ImportUrlSchema } from "@/lib/schemas/import"
import { listIngredientOptions, listUsedUnits } from "@/lib/services/catalog"
import { importRecipeFromUrl, type RecipeDraft } from "@/lib/services/import"
import { listTags } from "@/lib/services/recipes"
import { firstOf } from "@/lib/search-params"

export const metadata = { title: "Importa una ricetta" }

// Android's share intent carries the link in EXTRA_TEXT, so Chrome delivers it
// in `text` and leaves `url` empty. Reading `url` alone is the single most
// common cause of a share target that silently does nothing — design §6.1.
function sharedLink(url: string | undefined, text: string | undefined) {
  if (url !== undefined && url.trim() !== "") return url.trim()
  const match = /https?:\/\/\S+/i.exec(text ?? "")
  return match === null ? null : match[0]
}

const empty = (sourceUrl: string) => ({
  title: "",
  sourceUrl,
  servings: "",
  totalMinutes: "",
  instructions: "",
  notes: "",
  tags: [] as string[],
  ingredients: [],
})

const filled = (draft: RecipeDraft) => ({
  title: draft.title,
  sourceUrl: draft.sourceUrl,
  servings: draft.servings === null ? "" : String(draft.servings),
  totalMinutes: draft.totalMinutes === null ? "" : String(draft.totalMinutes),
  instructions: draft.instructions,
  notes: "",
  tags: [] as string[],
  ingredients: draft.ingredients.map((row, index) => ({
    key: `row-${index}`,
    ingredientName: row.ingredientName,
    unit: row.unit ?? "",
    quantity: row.quantity === null ? "" : String(row.quantity),
  })),
})

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string | string[]; text?: string | string[] }>
}) {
  const params = await searchParams
  const link = sharedLink(firstOf(params.url), firstOf(params.text))

  // Narrowed to a plain string before the ternary below: `parsed?.success` does
  // not narrow `parsed.data` through an optional chain.
  const parsed = link === null ? null : ImportUrlSchema.safeParse(link)
  const target = parsed !== null && parsed.success ? parsed.data : null

  // In parallel: awaiting them in sequence is the waterfall the React
  // guidelines rank CRITICAL. The import is one of them, and it is the slow one.
  const [draft, options, units, tagSuggestions] = await Promise.all([
    target === null ? null : importRecipeFromUrl(target),
    listIngredientOptions(),
    listUsedUnits(),
    listTags(),
  ])

  if (link === null) {
    return (
      <DetailBody>
        <PageHeader
          title="Importa una ricetta"
          back={{ href: "/recipes", label: "Ricettario" }}
          subtitle="Incolla il link di una ricetta e la leggo per te."
        />

        {/* A plain GET form: no "use client", no state, and it works with
            JavaScript off. Submitting lands on this same page with the link in
            the query, which is the path the share sheet takes too. */}
        <form action="/import" method="get" className="flex flex-col gap-6">
          <TextField
            id="url"
            name="url"
            label="Link della ricetta"
            type="url"
            inputMode="url"
            placeholder="https://…"
            spellCheck={false}
            autoComplete="off"
            required
          />
          <Button type="submit" className="w-fit">
            Leggi
          </Button>
        </form>
      </DetailBody>
    )
  }

  return (
    <DetailBody>
      <PageHeader
        title="Importa una ricetta"
        back={{ href: "/recipes", label: "Ricettario" }}
        subtitle={
          draft === null
            ? "Non sono riuscito a leggere questa pagina. Compilala a mano."
            : "Controlla quello che ho letto, poi salva."
        }
      />

      <RecipeForm
        action={saveRecipe}
        options={options}
        units={units}
        tagSuggestions={tagSuggestions}
        onCreateIngredient={addIngredient}
        // `target` and not `link`: a share carrying something that is not an
        // http(s) URL must not pre-fill Fonte with a value the recipe schema
        // will then refuse.
        values={draft === null ? empty(target ?? "") : filled(draft)}
      />
    </DetailBody>
  )
}
