-- Renames, written by hand. `prisma migrate dev` reads a rename as a drop and a
-- create, which would take every menu in the database with it.

ALTER TABLE "MenuSlot" RENAME TO "MenuEntry";
ALTER TABLE "MenuEntry" RENAME CONSTRAINT "MenuSlot_pkey" TO "MenuEntry_pkey";
ALTER TABLE "MenuEntry" RENAME CONSTRAINT "MenuSlot_menuId_fkey" TO "MenuEntry_menuId_fkey";
ALTER TABLE "MenuEntry" RENAME CONSTRAINT "MenuSlot_recipeId_fkey" TO "MenuEntry_recipeId_fkey";

ALTER TABLE "Menu" RENAME COLUMN "slotsUpdatedAt" TO "entriesUpdatedAt";

-- The constraint this whole change exists to remove: one dish per meal.
DROP INDEX "MenuSlot_menuId_day_meal_key";

-- Every meal holds at most one entry today, so they all start at zero and the
-- default has done its work the moment it is applied.
ALTER TABLE "MenuEntry" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MenuEntry" ALTER COLUMN "position" DROP DEFAULT;

CREATE INDEX "MenuEntry_menuId_day_meal_idx" ON "MenuEntry"("menuId", "day", "meal");
