-- Impression compacte des reçus : mode choisi par l'école, et reçus déjà
-- imprimés. Ajouts seulement.
ALTER TABLE "schools" ADD COLUMN "receiptPrintMode" TEXT NOT NULL DEFAULT 'TWO_PER_PAGE';
ALTER TABLE "payments" ADD COLUMN "receiptPrintedAt" TIMESTAMP(3);
