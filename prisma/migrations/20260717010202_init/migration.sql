/*
  Warnings:

  - You are about to drop the column `passwordHash` on the `User` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "googleId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "email", "id", "isOwner", "name", "role") SELECT "createdAt", "email", "id", "isOwner", "name", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
