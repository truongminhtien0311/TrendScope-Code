-- CreateTable
CREATE TABLE "ProductComparison" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productIds" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "presetName" TEXT,
    "resultMarkdown" TEXT,
    "errorMessage" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "ProductComparison_startedAt_idx" ON "ProductComparison"("startedAt");
