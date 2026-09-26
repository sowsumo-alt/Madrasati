-- Logo « en-tête complet » : ajout seulement, faux par défaut, aucune
-- école existante ne change d'affichage.
ALTER TABLE "schools" ADD COLUMN "logoIsLetterhead" BOOLEAN NOT NULL DEFAULT false;
