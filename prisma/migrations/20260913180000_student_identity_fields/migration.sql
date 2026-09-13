-- Dossier eleve de la maquette de septembre 2026 : lieu de naissance,
-- nationalite et nom de la mere. Colonnes facultatives, sans valeur par
-- defaut : les eleves deja inscrits ne sont pas modifies.
-- AlterTable
ALTER TABLE "students" ADD COLUMN "placeOfBirth" TEXT,
ADD COLUMN "nationality" TEXT,
ADD COLUMN "motherName" TEXT;
