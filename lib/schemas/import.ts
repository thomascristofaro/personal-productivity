import { z } from "zod"

import { RECIPE_SOURCE_URL_MAX } from "@/lib/schemas/recipe"

// The same rule RecipeInputSchema applies to a recipe's own sourceUrl: z.url()
// alone accepts any scheme, `javascript:` included. The length cap matches too,
// because whatever arrives here is what lands in that column.
export const ImportUrlSchema = z
  .url("L’indirizzo deve essere un URL valido.")
  .max(RECIPE_SOURCE_URL_MAX)
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "L’indirizzo deve iniziare con http:// o https://",
  })
