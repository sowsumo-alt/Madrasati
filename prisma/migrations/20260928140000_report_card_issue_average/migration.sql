-- Moyenne générale d'un bulletin remis, reprise par les trimestres suivants.
-- Ajout seulement : colonne facultative.
ALTER TABLE "report_card_issues" ADD COLUMN "average" DOUBLE PRECISION;
