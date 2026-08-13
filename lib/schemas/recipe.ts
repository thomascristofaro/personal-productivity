import { z } from "zod"

export const RECIPE_TITLE_MAX = 200
export const RECIPE_NOTES_MAX = 2000

// A zero would reach the shopping-list aggregator as a divisor and produce
// Infinity; a fraction cannot be a number of people.
const servings = z.int().positive().max(50).optional()

// z.url() alone accepts any scheme, including javascript:.
const sourceUrl = z
  .union([
    z.literal(""),
    z.url().refine((value) => /^https?:\/\//.test(value), {
      message: "L'indirizzo deve iniziare con http:// o https://",
    }),
  ])
  .default("")

export const RecipeInputSchema = z.object({
  title: z.string().trim().min(1).max(RECIPE_TITLE_MAX),
  sourceUrl,
  servings,
  totalMinutes: z.int().positive().max(2880).optional(),
  instructions: z.string().max(20000).default(""),
  notes: z.string().max(RECIPE_NOTES_MAX).default(""),
  // Free-form and comma-separated; §12.2 keeps normalisation shallow until a
  // duplicate is a nuisance.
  tags: z.string().max(500).default(""),
  // One ingredient per line, kept as written. The parser reads them server-side.
  ingredients: z.string().trim().min(1).max(10000),
})

export type RecipeInput = z.infer<typeof RecipeInputSchema>
