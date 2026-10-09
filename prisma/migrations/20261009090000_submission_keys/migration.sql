-- Encaissements idempotents : un même envoi de formulaire n'est traité qu'une fois.
-- Ajout seulement : aucune donnée existante n'est modifiée.
-- Retour arrière : DROP TABLE "submission_keys";

CREATE TABLE "submission_keys" (
    "schoolId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_keys_pkey" PRIMARY KEY ("schoolId","key")
);

ALTER TABLE "submission_keys" ADD CONSTRAINT "submission_keys_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
