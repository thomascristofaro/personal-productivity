-- Written by hand. `prisma migrate dev` generates a DROP TABLE and a CREATE
-- TABLE for a renamed model — it said so, refusing to run non-interactively
-- because the table it wanted to drop held 110 rows. Renames instead: Postgres
-- performs them atomically and carries the foreign key across by itself.
ALTER TABLE "Ingredient" RENAME TO "CatalogItem";

-- Not cosmetic. An index still named after the old table is what makes the next
-- `prisma migrate diff` believe the schema has drifted.
ALTER INDEX "Ingredient_pkey" RENAME TO "CatalogItem_pkey";

-- RecipeIngredient needs no statement at all: its column keeps its name, so its
-- foreign key and its index keep theirs too. See section 3 of
-- docs/superpowers/specs/2026-08-18-catalogue-and-purchases-design.md.

CREATE TYPE "CatalogItemKind" AS ENUM ('INGREDIENT', 'PRODUCT');

ALTER TABLE "CatalogItem"
  ADD COLUMN "kind" "CatalogItemKind" NOT NULL DEFAULT 'INGREDIENT';
