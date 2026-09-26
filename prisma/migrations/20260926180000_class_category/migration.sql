-- Catégorie d'une classe (Préscolaire, Fondamental, Collège, Lycée, ou
-- catégorie propre à l'école). Ajout seulement : facultative, les classes
-- existantes la déduisent de leur niveau.
ALTER TABLE "classes" ADD COLUMN "category" TEXT;
