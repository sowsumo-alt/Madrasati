-- Le dernier mois de l'année payé dès l'inscription, au choix de chaque école.
-- Ajout seulement.
ALTER TABLE "schools" ADD COLUMN "prepayLastMonth" BOOLEAN NOT NULL DEFAULT false;
