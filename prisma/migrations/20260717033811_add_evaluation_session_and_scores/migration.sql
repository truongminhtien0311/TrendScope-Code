-- CreateTable
CREATE TABLE "EvaluationSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "productIds" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProductScore" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "axesJson" TEXT,
    "errorMessage" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "ProductScore_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EvaluationSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductScore_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProductComparison" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productIds" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "presetName" TEXT,
    "resultMarkdown" TEXT,
    "errorMessage" TEXT,
    "sourceComparisonIds" TEXT,
    "sessionId" INTEGER,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "ProductComparison_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EvaluationSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProductComparison" ("errorMessage", "finishedAt", "id", "presetName", "productIds", "resultMarkdown", "sourceComparisonIds", "startedAt", "status") SELECT "errorMessage", "finishedAt", "id", "presetName", "productIds", "resultMarkdown", "sourceComparisonIds", "startedAt", "status" FROM "ProductComparison";
DROP TABLE "ProductComparison";
ALTER TABLE "new_ProductComparison" RENAME TO "ProductComparison";
CREATE INDEX "ProductComparison_startedAt_idx" ON "ProductComparison"("startedAt");
CREATE INDEX "ProductComparison_sessionId_idx" ON "ProductComparison"("sessionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ProductScore_sessionId_productId_key" ON "ProductScore"("sessionId", "productId");
