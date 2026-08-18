import { z } from "zod"

import {
  catalogName,
  CatalogItemKindSchema,
  UNIT_MAX,
} from "@/lib/schemas/catalog"

export const ShoppingItemIdSchema = z.cuid("Questa riga non è valida.")

// A merged line stands for every row behind it, so a tick posts several ids.
// Twenty is far above what one name and one unit can realistically produce and
// far below what a forged post would want.
export const ShoppingItemIdsSchema = z
  .array(ShoppingItemIdSchema)
  .min(1, "Questa riga non è valida.")
  .max(20, "Questa riga non è valida.")

export const ManualItemSchema = z.object({
  // A manual line need not exist in the catalogue — "sacchetti" never will —
  // but it is normalised the same way, because the merge of design document
  // section 6 keys on this name and "Pomodori" would open a second line.
  name: catalogName("Scrivi che cosa serve."),
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

// What the drawer posts: a line, plus what to do about the catalogue. Separate
// from ManualItemSchema because the line itself does not care — see section 7
// of the design document of 2026-08-18.
export const AddShoppingItemSchema = ManualItemSchema.extend({
  // No default. An unticked checkbox posts nothing at all, so what a missing
  // field means is the action's decision, and this schema stays honest about
  // having been handed a boolean.
  remember: z.boolean(),
  kind: CatalogItemKindSchema,
})

export type AddShoppingItem = z.infer<typeof AddShoppingItemSchema>
