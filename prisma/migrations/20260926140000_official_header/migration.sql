-- Bloc officiel des bulletins, commun à toutes les écoles et modifiable par
-- le seul Super Admin. Ajout seulement : aucune donnée existante modifiée.
CREATE TABLE "official_header" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "linesFr" TEXT[],
    "linesAr" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "official_header_pkey" PRIMARY KEY ("id")
);
