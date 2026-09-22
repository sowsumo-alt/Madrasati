-- Règles de calcul des moyennes, propres à chaque école, et trace des
-- bulletins déjà remis. Ajouts seulement : aucune table ni colonne existante
-- n'est modifiée ou supprimée.

CREATE TABLE "grading_configs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "grading_configs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "grading_configs_schoolId_idx" ON "grading_configs"("schoolId");
CREATE INDEX "grading_configs_schoolId_isCurrent_idx" ON "grading_configs"("schoolId", "isCurrent");

ALTER TABLE "grading_configs" ADD CONSTRAINT "grading_configs_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "report_card_issues" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "gradingConfigId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedByUserId" TEXT,

    CONSTRAINT "report_card_issues_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "report_card_issues_studentId_academicYearId_term_key"
    ON "report_card_issues"("studentId", "academicYearId", "term");
CREATE INDEX "report_card_issues_schoolId_idx" ON "report_card_issues"("schoolId");

ALTER TABLE "report_card_issues" ADD CONSTRAINT "report_card_issues_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_card_issues" ADD CONSTRAINT "report_card_issues_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_card_issues" ADD CONSTRAINT "report_card_issues_gradingConfigId_fkey"
    FOREIGN KEY ("gradingConfigId") REFERENCES "grading_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
