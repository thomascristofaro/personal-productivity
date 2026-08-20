import { minutesFromDuration } from "@/lib/duration"
import { findRecipe, type JsonLdNode, readJsonLd } from "@/lib/json-ld"
import {
  RECIPE_TITLE_MAX,
  SERVINGS_MAX,
  TOTAL_MINUTES_MAX,
} from "@/lib/schemas/recipe"
import { parseIngredientLine } from "@/lib/services/ingredient-parse"
import { fetchPublicPage } from "@/lib/url-guard"

const MAX_INGREDIENTS = 100

export type DraftIngredient = {
  ingredientName: string
  unit: string | null
  quantity: number | null
}

export type RecipeDraft = {
  title: string
  sourceUrl: string
  servings: number | null
  totalMinutes: number | null
  instructions: string
  ingredients: DraftIngredient[]
}

// A JSON-LD value is whatever the site put there: a string, an array of them, or
// an object carrying a `text`. A HowToStep is the last of those.
function textOf(value: unknown): string {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join(" ")
  if (value !== null && typeof value === "object") {
    const text = (value as Record<string, unknown>).text
    return typeof text === "string" ? text : ""
  }
  return ""
}

// "4 - 6 porzioni" is a range, and the first number is the one the recipe is
// written for. The confirmation screen exists to change it.
function firstNumber(value: unknown): number | null {
  const match = /\d+/.exec(textOf(value))
  return match === null ? null : Number(match[0])
}

// A value the recipe schema would refuse must not be pre-filled: a form that
// opens holding something it will not save reads as broken.
function withinRange(value: number | null, max: number): number | null {
  if (value === null) return null
  return value >= 1 && value <= max ? value : null
}

function instructionsOf(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (!Array.isArray(value)) return ""

  return value
    .map((step) => textOf(step).trim())
    .filter((step) => step !== "")
    .join("\n\n")
}

function ingredientsOf(node: JsonLdNode): DraftIngredient[] {
  const lines = node.recipeIngredient
  if (!Array.isArray(lines)) return []

  return lines
    .filter((line): line is string => typeof line === "string")
    .slice(0, MAX_INGREDIENTS)
    .map((line) => parseIngredientLine(line))
    .filter((parsed) => parsed.name !== "")
    .map((parsed) => ({
      ingredientName: parsed.name,
      unit: parsed.unit,
      quantity: parsed.quantity,
    }))
}

/**
 * Maps a page's markup to a recipe draft.
 *
 * Separate from the fetch so it can be tested against a captured page rather
 * than a live site.
 *
 * @param html - the page's markup
 * @param sourceUrl - the address it came from, kept for the recipe's Fonte
 * @returns the draft, or null when the page published no readable recipe
 */
export function draftFromHtml(
  html: string,
  sourceUrl: string
): RecipeDraft | null {
  const recipe = findRecipe(readJsonLd(html))
  if (recipe === null) return null

  const title = textOf(recipe.name).trim().slice(0, RECIPE_TITLE_MAX)
  if (title === "") return null

  const total =
    minutesFromDuration(recipe.totalTime) ??
    (minutesFromDuration(recipe.prepTime) ?? 0) +
      (minutesFromDuration(recipe.cookTime) ?? 0)

  return {
    title,
    sourceUrl,
    servings: withinRange(firstNumber(recipe.recipeYield), SERVINGS_MAX),
    totalMinutes: withinRange(total, TOTAL_MINUTES_MAX),
    instructions: instructionsOf(recipe.recipeInstructions),
    ingredients: ingredientsOf(recipe),
  }
}

/**
 * Reads a recipe from the page at a URL.
 *
 * @param url - the address, already validated with ImportUrlSchema
 * @returns the draft, or null when the page cannot be read or holds no recipe
 */
export async function importRecipeFromUrl(
  url: string
): Promise<RecipeDraft | null> {
  // A site that refuses us, times out or answers rubbish is an ordinary outcome
  // with a screen behind it, not a fault worth an error boundary.
  try {
    return draftFromHtml(await fetchPublicPage(url), url)
  } catch {
    return null
  }
}
