-- CreateTable
CREATE TABLE "LlmFunction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "maxTokens" INTEGER NOT NULL DEFAULT 4096,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmFunction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmExecution" (
    "id" TEXT NOT NULL,
    "functionId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "output" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LlmExecution_functionId_createdAt_idx" ON "LlmExecution"("functionId", "createdAt");

-- AddForeignKey
ALTER TABLE "LlmExecution" ADD CONSTRAINT "LlmExecution_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "LlmFunction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
