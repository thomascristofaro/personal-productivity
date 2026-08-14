import { z } from "zod"

export const RECIPE_TITLE_MAX = 200
export const RECIPE_NOTES_MAX = 2000
export const RECIPE_SOURCE_URL_MAX = 2000

// A zero would reach the shopping-list aggregator as a divisor and produce
// Infinity; a fraction cannot be a number of people.
const servings = z
  .int("Le porzioni devono essere un numero intero.")
  .positive("Le porzioni devono essere maggiori di zero.")
  .max(50, "Le porzioni non possono superare 50.")
  .optional()

// z.url() alone accepts any scheme, including javascript:.
const sourceUrl = z
  .union([
    z.literal(""),
    z
      .url()
      .max(RECIPE_SOURCE_URL_MAX)
      .refine((value) => /^https?:\/\//i.test(value), {
        message: "L'indirizzo deve iniziare con http:// o https://",
      }),
  ])
  .default("")

export const RecipeInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Il nome non può essere vuoto.")
    .max(
      RECIPE_TITLE_MAX,
      `Il nome può avere al massimo ${RECIPE_TITLE_MAX} caratteri.`
    ),
  sourceUrl,
  servings,
  totalMinutes: z
    .int("I minuti devono essere un numero intero.")
    .positive("I minuti devono essere maggiori di zero.")
    .max(2880, "I minuti non possono superare 2880 (48 ore).")
    .optional(),
  instructions: z
    .string()
    .max(20000, "La preparazione può avere al massimo 20000 caratteri.")
    .default(""),
  notes: z
    .string()
    .max(
      RECIPE_NOTES_MAX,
      `Le note possono avere al massimo ${RECIPE_NOTES_MAX} caratteri.`
    )
    .default(""),
  // Free-form and comma-separated; §12.2 keeps normalisation shallow until a
  // duplicate is a nuisance.
  tags: z
    .string()
    .max(500, "Le etichette possono avere al massimo 500 caratteri.")
    .default(""),
  // One ingredient per line, kept as written. The parser reads them server-side.
  ingredients: z
    .string()
    .trim()
    .min(1, "Serve almeno un ingrediente.")
    .max(
      10000,
      "L'elenco degli ingredienti è troppo lungo: massimo 10000 caratteri."
    ),
})

export type RecipeInput = z.infer<typeof RecipeInputSchema>
