import { z } from "zod"

import { RecipeIngredientRowSchema } from "@/lib/schemas/catalog"

export const RECIPE_TITLE_MAX = 200
export const RECIPE_NOTES_MAX = 2000
export const RECIPE_SOURCE_URL_MAX = 2000
// Read by lib/services/import.ts, which drops a value outside the range rather
// than pre-filling a form with something this schema will then refuse.
export const SERVINGS_MAX = 50
export const TOTAL_MINUTES_MAX = 2880

// A zero would reach the shopping-list aggregator as a divisor and produce
// Infinity; a fraction cannot be a number of people.
const servings = z
  .int("Le porzioni devono essere un numero intero.")
  .positive("Le porzioni devono essere maggiori di zero.")
  .max(SERVINGS_MAX, `Le porzioni non possono superare ${SERVINGS_MAX}.`)
  .optional()

// z.url() alone accepts any scheme, including javascript:.
const sourceUrl = z
  .union([
    z.literal(""),
    z
      .url("L'indirizzo deve essere un URL valido.")
      .max(
        RECIPE_SOURCE_URL_MAX,
        `L'indirizzo può avere al massimo ${RECIPE_SOURCE_URL_MAX} caratteri.`
      )
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
    .max(
      TOTAL_MINUTES_MAX,
      `I minuti non possono superare ${TOTAL_MINUTES_MAX} (48 ore).`
    )
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
  // Free-form labels chosen from the ones already used, or typed in. §12.2
  // keeps normalisation shallow until a duplicate is a nuisance.
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Un’etichetta non può essere vuota.")
        .max(50, "Un’etichetta può avere al massimo 50 caratteri.")
    )
    .max(20, "Al massimo 20 etichette.")
    .default([]),
  ingredients: z
    .array(RecipeIngredientRowSchema)
    .min(1, "Serve almeno un ingrediente.")
    .max(100, "Al massimo 100 ingredienti per ricetta."),
})

export type RecipeInput = z.infer<typeof RecipeInputSchema>
