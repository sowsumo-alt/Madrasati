-- Inscription groupée par famille (retour terrain, École Ngalam) : un nom de
-- famille facultatif sur le parent, et le paiement familial qui porte un reçu
-- unique pour plusieurs enfants. Uniquement des ajouts : colonnes facultatives
-- et nouvelle table, aucune donnée existante n'est modifiée.

-- AlterTable
ALTER TABLE "parents" ADD COLUMN "familyName" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "familyPaymentId" TEXT;

-- CreateTable
CREATE TABLE "family_payments" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "parentId" TEXT,
    "receiptNumber" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT,
    "note" TEXT,

    CONSTRAINT "family_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "family_payments_schoolId_idx" ON "family_payments"("schoolId");

-- CreateIndex
CREATE INDEX "family_payments_parentId_idx" ON "family_payments"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "family_payments_schoolId_receiptNumber_key" ON "family_payments"("schoolId", "receiptNumber");

-- CreateIndex
CREATE INDEX "payments_familyPaymentId_idx" ON "payments"("familyPaymentId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_familyPaymentId_fkey" FOREIGN KEY ("familyPaymentId") REFERENCES "family_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_payments" ADD CONSTRAINT "family_payments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_payments" ADD CONSTRAINT "family_payments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "parents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
