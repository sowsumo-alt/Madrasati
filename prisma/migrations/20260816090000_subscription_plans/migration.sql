-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'standard';

-- CreateTable
CREATE TABLE "plan_upgrade_requests" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "currentPlan" TEXT NOT NULL,
    "requestedPlan" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_upgrade_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_upgrade_requests_schoolId_idx" ON "plan_upgrade_requests"("schoolId");

-- AddForeignKey
ALTER TABLE "plan_upgrade_requests" ADD CONSTRAINT "plan_upgrade_requests_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
