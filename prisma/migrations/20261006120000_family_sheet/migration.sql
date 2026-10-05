-- Fiche de paiement familiale : réglages d'école et rattachement à la
-- famille. Ajouts seulement : aucune donnée existante n'est modifiée.
ALTER TABLE "schools" ADD COLUMN "amountUnit" TEXT NOT NULL DEFAULT 'MRU';
ALTER TABLE "schools" ADD COLUMN "familySheetMode" TEXT NOT NULL DEFAULT 'FAMILY';

ALTER TABLE "fees" ADD COLUMN "familyParentId" TEXT;
ALTER TABLE "fees" ADD CONSTRAINT "fees_familyParentId_fkey" FOREIGN KEY ("familyParentId") REFERENCES "parents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "fees_familyParentId_idx" ON "fees"("familyParentId");

ALTER TABLE "tuition_plans" ADD COLUMN "familyParentId" TEXT;
ALTER TABLE "tuition_plans" ADD CONSTRAINT "tuition_plans_familyParentId_fkey" FOREIGN KEY ("familyParentId") REFERENCES "parents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
