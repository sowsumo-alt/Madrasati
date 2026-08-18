-- Une ecole nait en formule Avancee pour essayer l'application complete
-- pendant sa periode d'essai gratuite, sans avoir a choisir a l'inscription.
-- Seul le defaut change : les ecoles deja en base gardent leur formule.
-- AlterTable
ALTER TABLE "schools" ALTER COLUMN "plan" SET DEFAULT 'advanced';
