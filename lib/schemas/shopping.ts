import { z } from "zod"

import {
  catalogName,
  CatalogItemKindSchema,
  UnitSchema,
} from "@/lib/schemas/catalog"

export const ShoppingItemIdSchema = z.cuid("Questa riga non è valida.")

export const PurchaseIdSchema = z.cuid("Questa spesa non è valida.")

// Ten thousand euro. Far above any weekly shop and far below what a slipped key
// produces, which is the point: this is what catches 100000 typed for 100,00.
const MAX_CENTS = 1_000_000

const AMOUNT = /^\d+([.]\d{1,2})?$/

/**
 * The amount paid, as typed. Empty means "not yet", which is a real state: a
 * shop can be closed at the till and priced when the receipt is to hand.
 *
 * Named for what it returns. A name saying "amount" would invite somebody to
 * treat the output as euro, and it is cents.
 */
export const EuroCentsSchema = z
  .string()
  .trim()
  // One comma, because an Italian keyboard gives a comma and a numeric keypad
  // gives a dot. A thousands separator therefore fails the pattern below, and
  // the message says so rather than reading 1.234,56 as something else.
  .transform((value) => value.replace(",", "."))
  .refine((value) => value === "" || AMOUNT.test(value), {
    message: "Scrivi l’importo come 12,34, senza separatore delle migliaia.",
  })
  // Math.round and not a bare multiplication: 12.34 * 100 is 1233.9999999999998,
  // and truncating loses a cent on roughly every third amount.
  .transform((value) => (value === "" ? null : Math.round(Number(value) * 100)))
  .refine((cents) => cents === null || cents <= MAX_CENTS, {
    message: "L’importo sembra troppo alto. Controlla la virgola.",
  })

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
  // Shared with the catalogue and the recipe row, which is what makes the
  // numeric-unit refusal apply everywhere a unit can be typed.
  unit: UnitSchema,
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
