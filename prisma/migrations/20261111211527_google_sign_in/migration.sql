-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GoogleCalendar" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "accountEmail" TEXT,
    "refreshToken" TEXT,
    "clientEmail" TEXT,
    "privateKey" TEXT,
    "calendarId" TEXT NOT NULL,
    "fullNames" BOOLEAN NOT NULL DEFAULT false,
    "appUrl" TEXT,
    "lastSyncAt" DATETIME,
    "lastError" TEXT,
    "lastErrorAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_GoogleCalendar" ("appUrl", "calendarId", "clientEmail", "createdAt", "fullNames", "id", "lastError", "lastErrorAt", "lastSyncAt", "privateKey", "updatedAt") SELECT "appUrl", "calendarId", "clientEmail", "createdAt", "fullNames", "id", "lastError", "lastErrorAt", "lastSyncAt", "privateKey", "updatedAt" FROM "GoogleCalendar";
DROP TABLE "GoogleCalendar";
ALTER TABLE "new_GoogleCalendar" RENAME TO "GoogleCalendar";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
