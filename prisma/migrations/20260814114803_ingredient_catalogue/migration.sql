/*
  Warnings:

  - You are about to drop the column `name` on the `RecipeIngredient` table. All the data in the column will be lost.
  - You are about to drop the column `raw` on the `RecipeIngredient` table. All the data in the column will be lost.
  - You are about to drop the `IngredientAisle` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `ingredientName` to the `RecipeIngredient` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "RecipeIngredient" DROP COLUMN "name",
DROP COLUMN "raw",
ADD COLUMN     "ingredientName" TEXT NOT NULL;

-- DropTable
DROP TABLE "IngredientAisle";

-- CreateTable
CREATE TABLE "Ingredient" (
    "name" TEXT NOT NULL,
    "defaultUnit" TEXT,
    "aisle" TEXT NOT NULL DEFAULT 'altro',

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE INDEX "RecipeIngredient_ingredientName_idx" ON "RecipeIngredient"("ingredientName");

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_ingredientName_fkey" FOREIGN KEY ("ingredientName") REFERENCES "Ingredient"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
