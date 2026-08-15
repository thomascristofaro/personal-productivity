import { z } from "zod"

import { INGREDIENT_NAME_MAX, UNIT_MAX } from "@/lib/schemas/ingredient"

export const ShoppingItemIdSchema = z.cuid("Questa riga non è valida.")

export const ManualItemSchema = z.object({
  // Not IngredientNameSchema: a manual item is free text and need not exist in
  // the catalogue — "sacchetti" never will. Only the length is shared.
  name: z
    .string()
    .trim()
    .min(1, "Scrivi che cosa serve.")
    .max(
      INGREDIENT_NAME_MAX,
      `Il nome può avere al massimo ${INGREDIENT_NAME_MAX} caratteri.`
    ),
  // A plain string, not an enum: lib/schemas may import Zod and its siblings,
  // so AISLE_ORDER is out of reach. The service checks membership.
  aisle: z
    .string()
    .trim()
    .min(1, "Scegli un reparto.")
    .max(50, "Il reparto può avere al massimo 50 caratteri."),
  quantity: z
    .number("La quantità deve essere un numero.")
    .positive("La quantità deve essere maggiore di zero.")
    .max(100000, "La quantità non può superare 100000.")
    .nullable(),
  unit: z
    .string()
    .trim()
    .max(UNIT_MAX, `L’unità può avere al massimo ${UNIT_MAX} caratteri.`)
    .nullable()
    .transform((value) => (value === null || value === "" ? null : value)),
})

export type ManualItem = z.infer<typeof ManualItemSchema>
