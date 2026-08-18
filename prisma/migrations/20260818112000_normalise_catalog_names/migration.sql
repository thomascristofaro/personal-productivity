-- The design document said the catalogue was already all lowercase and that
-- there was nothing to backfill. Two rows added from the app since — "Cocomero"
-- and "Olive verdi" — say otherwise, and they are precisely the defect the
-- lowercasing was added to stop.
--
-- The same expression as CatalogItemNameSchema in lib/schemas/catalog.ts:
-- trimmed, inner whitespace collapsed, lowercased. Keep the two in step.
--
-- CatalogItem.name is a primary key with ON UPDATE CASCADE, so RecipeIngredient
-- follows by itself. If two rows ever normalised to the same name the unique
-- constraint would abort this migration, which is the right outcome: merging
-- two catalogue entries is a decision, not something a migration should guess.
UPDATE "CatalogItem"
SET "name" = lower(regexp_replace(btrim("name"), '\s+', ' ', 'g'))
WHERE "name" <> lower(regexp_replace(btrim("name"), '\s+', ' ', 'g'));

-- ShoppingListItem.name is a copied string and not a foreign key, so nothing
-- cascades into it. Left alone, a line reading "Cocomero" would never merge
-- with the "cocomero" the menu produces. Duplicates are fine here — there is no
-- unique constraint, and merging them on read is exactly what happens next.
UPDATE "ShoppingListItem"
SET "name" = lower(regexp_replace(btrim("name"), '\s+', ' ', 'g'))
WHERE "name" <> lower(regexp_replace(btrim("name"), '\s+', ' ', 'g'));
