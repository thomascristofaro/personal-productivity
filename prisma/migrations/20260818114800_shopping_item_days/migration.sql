-- AlterTable
ALTER TABLE "ShoppingListItem" ADD COLUMN     "days" INTEGER[];

-- The statement above is what Prisma generates, and it leaves existing rows at
-- NULL. Prisma reads a NULL scalar list back as an empty array, so nothing
-- breaks — but "no days" and "not answered yet" then look identical in psql and
-- in any query written outside Prisma. An empty array says the same thing and
-- says it in the database. No schema-level DEFAULT, because the model declares
-- none and one here would read as drift on the next diff.
UPDATE "ShoppingListItem" SET "days" = '{}' WHERE "days" IS NULL;
