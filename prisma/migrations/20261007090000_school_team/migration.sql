-- Plusieurs utilisateurs par école : directeur principal, accès, journal d'activité.

ALTER TABLE "users" ADD COLUMN "isOwner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "access" TEXT NOT NULL DEFAULT 'FULL';

-- Le directeur principal de chaque école : son premier directeur (aujourd'hui
-- chaque école n'en a qu'un, celui qui l'a créée).
UPDATE "users" SET "isOwner" = true
WHERE "id" IN (
  SELECT DISTINCT ON ("schoolId") "id" FROM "users"
  WHERE "role" = 'DIRECTOR'
  ORDER BY "schoolId", "createdAt" ASC
);

CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "amount" INTEGER,
    "href" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activity_logs_schoolId_createdAt_idx" ON "activity_logs"("schoolId", "createdAt");

ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
