-- CreateTable
CREATE TABLE "teacher_contracts" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "leaveDaysPerYear" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_bonuses" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "teacher_bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_leaves" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "baseSalary" INTEGER NOT NULL,
    "deductions" INTEGER NOT NULL DEFAULT 0,
    "deductionNote" TEXT,
    "netPay" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedByUserId" TEXT,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslip_bonus_lines" (
    "id" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "payslip_bonus_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_contracts_teacherId_key" ON "teacher_contracts"("teacherId");

-- CreateIndex
CREATE INDEX "teacher_contracts_schoolId_idx" ON "teacher_contracts"("schoolId");

-- CreateIndex
CREATE INDEX "teacher_bonuses_contractId_idx" ON "teacher_bonuses"("contractId");

-- CreateIndex
CREATE INDEX "teacher_leaves_schoolId_idx" ON "teacher_leaves"("schoolId");

-- CreateIndex
CREATE INDEX "teacher_leaves_teacherId_idx" ON "teacher_leaves"("teacherId");

-- CreateIndex
CREATE INDEX "payslips_schoolId_idx" ON "payslips"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_teacherId_month_year_key" ON "payslips"("teacherId", "month", "year");

-- AddForeignKey
ALTER TABLE "teacher_contracts" ADD CONSTRAINT "teacher_contracts_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_contracts" ADD CONSTRAINT "teacher_contracts_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_bonuses" ADD CONSTRAINT "teacher_bonuses_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "teacher_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_leaves" ADD CONSTRAINT "teacher_leaves_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_leaves" ADD CONSTRAINT "teacher_leaves_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslip_bonus_lines" ADD CONSTRAINT "payslip_bonus_lines_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

