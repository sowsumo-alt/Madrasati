-- Jour limite de paiement + tolérance, et rappels de paiement envoyés.

ALTER TABLE "schools" ADD COLUMN "paymentDueDay" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "schools" ADD COLUMN "paymentGraceDays" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "payment_reminders" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "months" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_reminders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_reminders_schoolId_groupKey_sentAt_idx" ON "payment_reminders"("schoolId", "groupKey", "sentAt");

ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
