-- Une ecole nouvellement inscrite n'a aucun acces tant que l'editeur ne l'a
-- pas activee depuis le tableau de bord Super Admin. Seul le defaut change :
-- les ecoles deja en base conservent leur statut actuel.
-- AlterTable
ALTER TABLE "schools" ALTER COLUMN "subscriptionStatus" SET DEFAULT 'pending';
