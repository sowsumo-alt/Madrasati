-- Annulation d'un paiement : trace conservée, reçu marqué « ANNULÉ ».
-- Ajouts seulement : aucune donnée existante n'est modifiée.
ALTER TABLE "family_payments" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "family_payments" ADD COLUMN "cancelledByUserId" TEXT;
ALTER TABLE "family_payments" ADD COLUMN "cancelReason" TEXT;

CREATE TABLE "cancelled_payments" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT,
    "studentName" TEXT NOT NULL,
    "className" TEXT,
    "feeId" TEXT,
    "feeLabel" TEXT NOT NULL,
    "feeAmount" INTEGER NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "recordedByUserId" TEXT,
    "familyPaymentId" TEXT,
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledByUserId" TEXT,
    "cancelReason" TEXT NOT NULL,
    CONSTRAINT "cancelled_payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cancelled_payments_schoolId_idx" ON "cancelled_payments"("schoolId");
CREATE INDEX "cancelled_payments_studentId_idx" ON "cancelled_payments"("studentId");
CREATE INDEX "cancelled_payments_familyPaymentId_idx" ON "cancelled_payments"("familyPaymentId");
ALTER TABLE "cancelled_payments" ADD CONSTRAINT "cancelled_payments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cancelled_payments" ADD CONSTRAINT "cancelled_payments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cancelled_payments" ADD CONSTRAINT "cancelled_payments_familyPaymentId_fkey" FOREIGN KEY ("familyPaymentId") REFERENCES "family_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
