-- Examens de la maquette de septembre 2026 : type d'examen, heure de debut et
-- description / consignes. Colonnes facultatives, sans valeur par defaut : les
-- examens deja planifies ne sont pas modifies.
-- AlterTable
ALTER TABLE "exams" ADD COLUMN "kind" TEXT,
ADD COLUMN "startMinutes" INTEGER,
ADD COLUMN "instructions" TEXT;
