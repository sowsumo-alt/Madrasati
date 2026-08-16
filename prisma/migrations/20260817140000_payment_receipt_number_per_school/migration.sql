-- DropIndex
DROP INDEX "payments_receiptNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "payments_schoolId_receiptNumber_key" ON "payments"("schoolId", "receiptNumber");
