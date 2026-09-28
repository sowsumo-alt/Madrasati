-- Formules de paiement des frais de scolarité (mensuel, trimestriel, N mois,
-- annuel) et montant mensuel de l'école. Ajouts seulement : aucune donnée
-- existante n'est modifiée.

-- AlterTable
ALTER TABLE "fees" ADD COLUMN     "periodEnd" TIMESTAMP(3),
ADD COLUMN     "periodStart" TIMESTAMP(3),
ADD COLUMN     "tuitionPlanId" TEXT;

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "monthlyTuition" INTEGER;

-- CreateTable
CREATE TABLE "tuition_plans" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "periodMonths" INTEGER NOT NULL,
    "monthlyAmount" INTEGER NOT NULL,
    "firstMonth" TIMESTAMP(3) NOT NULL,
    "lastMonth" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tuition_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tuition_plans_schoolId_idx" ON "tuition_plans"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "tuition_plans_studentId_academicYearId_key" ON "tuition_plans"("studentId", "academicYearId");

-- CreateIndex
CREATE INDEX "fees_tuitionPlanId_idx" ON "fees"("tuitionPlanId");

-- AddForeignKey
ALTER TABLE "fees" ADD CONSTRAINT "fees_tuitionPlanId_fkey" FOREIGN KEY ("tuitionPlanId") REFERENCES "tuition_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tuition_plans" ADD CONSTRAINT "tuition_plans_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tuition_plans" ADD CONSTRAINT "tuition_plans_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tuition_plans" ADD CONSTRAINT "tuition_plans_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

