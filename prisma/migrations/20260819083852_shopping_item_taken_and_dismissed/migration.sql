-- AlterTable
ALTER TABLE "ShoppingListItem" ADD COLUMN     "dismissed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "takenQuantity" DOUBLE PRECISION;
