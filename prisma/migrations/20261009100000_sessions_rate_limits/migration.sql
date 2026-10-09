-- Sessions révocables et limitation des essais (connexion, inscription publique).
-- Ajouts seulement : aucune donnée existante n'est modifiée ; les sessions
-- actuelles restent valides (version 0 = version des jetons existants).
-- Retour arrière :
--   ALTER TABLE "users" DROP COLUMN "sessionVersion";
--   ALTER TABLE "super_admins" DROP COLUMN "sessionVersion";
--   DROP TABLE "rate_limits";

ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "super_admins" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);
