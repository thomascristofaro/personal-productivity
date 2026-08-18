import { z } from "zod"

export const CATALOG_NAME_MAX = 120
export const UNIT_MAX = 30

export const CATALOG_ITEM_KINDS = ["INGREDIENT", "PRODUCT"] as const

// No custom message: the kind is chosen from a select the user cannot type
// into, so the only way to fail this is to call the action directly.
export const CatalogItemKindSchema = z.enum(CATALOG_ITEM_KINDS)
export type CatalogItemKind = z.infer<typeof CatalogItemKindSchema>

// A factory rather than one schema the callers `.pipe()` a stricter `min` onto:
// piped schemas run in order, so the first empty check wins and every caller
// would report this module's wording. "Scegli un ingrediente." on a blank
// recipe row and "Scrivi che cosa serve." on a blank shopping line say what to
// do; "Il nome non può essere vuoto." only says what went wrong.
export const catalogName = (empty: string) =>
  z
    .string()
    .trim()
    // Lowercase and single-spaced, so what the user types is the same key the
    // seed wrote. Without this "Pomodori" is a second catalogue entry, and the
    // shopping list shows two lines for one thing — design document of
    // 2026-08-18, section 4.
    .transform((value) => value.toLowerCase().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(1, empty)
        .max(
          CATALOG_NAME_MAX,
          `Il nome può avere al massimo ${CATALOG_NAME_MAX} caratteri.`
        )
        // The name addresses the entry in a URL path segment; an encoded slash
        // is decoded back into a separator and the route stops matching.
        .refine((value) => !value.includes("/"), {
          message: "Il nome non può contenere «/».",
        })
    )

export const CatalogItemNameSchema = catalogName(
  "Il nome non può essere vuoto."
)

// An empty unit is absent, not blank: the aggregator treats "" and null
// differently, and a blank string would open a second line for the same thing.
const unit = z
  .string()
  .trim()
  .max(UNIT_MAX, `L’unità può avere al massimo ${UNIT_MAX} caratteri.`)
  .nullable()
  .transform((value) => (value === null || value === "" ? null : value))

// A plain string, not an enum: lib/schemas may import Zod and its siblings, so
// AISLE_ORDER is out of reach. The service checks membership.
const aisle = z
  .string()
  .trim()
  .min(1, "Scegli un reparto.")
  .max(50, "Il reparto può avere al massimo 50 caratteri.")

export const RecipeIngredientRowSchema = z.object({
  // The foreign key is the name, so the same constraints apply — the
  // lowercasing included, or a recipe line points at a key the catalogue does
  // not hold. Only the empty-row message differs, because here it means "you
  // left a row blank".
  ingredientName: catalogName("Scegli un ingrediente."),
  unit,
  quantity: z
    .number("La quantità deve essere un numero.")
    .positive("La quantità deve essere maggiore di zero.")
    .max(100000, "La quantità non può superare 100000.")
    .nullable(),
})

export type RecipeIngredientRow = z.infer<typeof RecipeIngredientRowSchema>

export const CatalogItemInputSchema = z.object({
  name: CatalogItemNameSchema,
  kind: CatalogItemKindSchema.default("INGREDIENT"),
  defaultUnit: unit,
  aisle,
})

export type CatalogItemInput = z.infer<typeof CatalogItemInputSchema>
