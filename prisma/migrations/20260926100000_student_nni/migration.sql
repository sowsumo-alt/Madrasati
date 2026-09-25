-- NNI (Numéro National d'Identification) de l'élève. Ajout seulement :
-- colonne facultative, aucune donnée existante modifiée.
ALTER TABLE "students" ADD COLUMN "nni" TEXT;
CREATE INDEX "students_schoolId_nni_idx" ON "students"("schoolId", "nni");
