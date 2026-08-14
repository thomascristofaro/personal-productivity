import { z } from "zod"

export const INGREDIENT_NAME_MAX = 120
export const UNIT_MAX = 30

export const IngredientNameSchema = z
  .string()
  .trim()
  .min(1, "Il nome dell’ingrediente non può essere vuoto.")
  .max(
    INGREDIENT_NAME_MAX,
    `Il nome dell’ingrediente può avere al massimo ${INGREDIENT_NAME_MAX} caratteri.`
  )
  // The name addresses the ingredient in a URL path segment; an encoded slash
  // is decoded back into a separator and the route stops matching.
  .refine((value) => !value.includes("/"), {
    message: "Il nome dell’ingrediente non può contenere «/».",
  })

// An empty unit is absent, not blank: the aggregator treats "" and null
// differently, and a blank string would open a second line for the same thing.
const unit = z
  .string()
  .trim()
  .max(UNIT_MAX, `L’unità può avere al massimo ${UNIT_MAX} caratteri.`)
  .nullable()
  .transform((value) => (value === null || value === "" ? null : value))

export const RecipeIngredientRowSchema = z.object({
  // The foreign key is the name, so the same constraints apply — only the
  // empty-row message differs, because here it means "you left a row blank".
  ingredientName: IngredientNameSchema.min(1, "Scegli un ingrediente."),
  unit,
  quantity: z
    .number("La quantità deve essere un numero.")
    .positive("La quantità deve essere maggiore di zero.")
    .max(100000, "La quantità non può superare 100000.")
    .nullable(),
})

export type RecipeIngredientRow = z.infer<typeof RecipeIngredientRowSchema>

export const IngredientInputSchema = z.object({
  name: IngredientNameSchema,
  defaultUnit: unit,
  // A plain string, not an enum: lib/schemas may import Zod and nothing else,
  // so AISLE_ORDER is out of reach. The service checks membership.
  aisle: z
    .string()
    .trim()
    .min(1, "Scegli un reparto.")
    .max(50, "Il reparto può avere al massimo 50 caratteri."),
})

export type IngredientInput = z.infer<typeof IngredientInputSchema>
