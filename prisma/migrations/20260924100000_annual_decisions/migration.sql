-- Décisions de fin d'année (mentions du conseil et décision de passage).
-- Ajout seulement : aucune table ni colonne existante n'est modifiée.

CREATE TABLE "annual_decisions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "honors" JSONB NOT NULL DEFAULT '[]',
    "decision" TEXT,
    "average" DOUBLE PRECISION,
    "validatedAt" TIMESTAMP(3),
    "validatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annual_decisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "annual_decisions_studentId_academicYearId_key"
    ON "annual_decisions"("studentId", "academicYearId");
CREATE INDEX "annual_decisions_schoolId_idx" ON "annual_decisions"("schoolId");

ALTER TABLE "annual_decisions" ADD CONSTRAINT "annual_decisions_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "annual_decisions" ADD CONSTRAINT "annual_decisions_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
