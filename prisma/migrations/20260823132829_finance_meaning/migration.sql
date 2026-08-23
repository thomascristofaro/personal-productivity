-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('EXPENSE', 'INCOME', 'TRANSFER');

-- CreateEnum
CREATE TYPE "CategorySource" AS ENUM ('NONE', 'MANUAL', 'RULE', 'PROVIDER_MAP', 'TRANSFER_LINK');

-- CreateEnum
CREATE TYPE "RuleKind" AS ENUM ('DESCRIPTION_CONTAINS', 'PROVIDER_CATEGORY_IS');

-- AlterTable
ALTER TABLE "Movement" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "categorySource" "CategorySource" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryRule" (
    "id" TEXT NOT NULL,
    "kind" "RuleKind" NOT NULL,
    "pattern" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "accountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferLink" (
    "id" TEXT NOT NULL,
    "fromMovementId" TEXT NOT NULL,
    "toMovementId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Category_archived_sortOrder_idx" ON "Category"("archived", "sortOrder");

-- CreateIndex
CREATE INDEX "CategoryRule_priority_idx" ON "CategoryRule"("priority");

-- CreateIndex
CREATE INDEX "CategoryRule_accountId_idx" ON "CategoryRule"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferLink_fromMovementId_key" ON "TransferLink"("fromMovementId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferLink_toMovementId_key" ON "TransferLink"("toMovementId");

-- CreateIndex
CREATE INDEX "Movement_categoryId_idx" ON "Movement"("categoryId");

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferLink" ADD CONSTRAINT "TransferLink_fromMovementId_fkey" FOREIGN KEY ("fromMovementId") REFERENCES "Movement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferLink" ADD CONSTRAINT "TransferLink_toMovementId_fkey" FOREIGN KEY ("toMovementId") REFERENCES "Movement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
