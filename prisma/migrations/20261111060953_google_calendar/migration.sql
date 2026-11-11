-- AlterTable
ALTER TABLE "Session" ADD COLUMN "googleEventId" TEXT;
ALTER TABLE "Session" ADD COLUMN "googleSyncError" TEXT;

-- CreateTable
CREATE TABLE "GoogleCalendar" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "clientEmail" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "fullNames" BOOLEAN NOT NULL DEFAULT false,
    "appUrl" TEXT,
    "lastSyncAt" DATETIME,
    "lastError" TEXT,
    "lastErrorAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
