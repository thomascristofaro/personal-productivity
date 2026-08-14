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
