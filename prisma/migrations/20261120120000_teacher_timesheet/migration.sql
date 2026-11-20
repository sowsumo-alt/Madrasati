-- Module « Pointage & paie des enseignants ».
-- Ajouts seulement : aucune colonne ni donnée existante n'est modifiée ou supprimée.
-- Les écoles gardent le module désactivé (timesheetEnabled = false) tant que le
-- Super Admin ne l'active pas.

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "checkInRadius" INTEGER NOT NULL DEFAULT 150,
ADD COLUMN     "lateDeduction" TEXT NOT NULL DEFAULT 'PRORATA',
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "timesheetEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timesheetGeneratedThrough" TIMESTAMP(3),
ADD COLUMN     "timesheetStartDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "hourlyRate" INTEGER;

-- CreateTable
CREATE TABLE "teaching_sessions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "scheduleSlotId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "classId" TEXT,
    "className" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "checkedInAt" TIMESTAMP(3),
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "checkInLat" DOUBLE PRECISION,
    "checkInLng" DOUBLE PRECISION,
    "checkInDistance" INTEGER,
    "replacementTeacherId" TEXT,
    "observation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teaching_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teaching_session_changes" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "fromReplacement" TEXT,
    "toReplacement" TEXT,
    "observation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teaching_session_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_pay_adjustments" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_pay_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_months" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "lockedByName" TEXT,
    "snapshot" JSONB,

    CONSTRAINT "timesheet_months_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_notifications" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teaching_sessions_schoolId_date_idx" ON "teaching_sessions"("schoolId", "date");

-- CreateIndex
CREATE INDEX "teaching_sessions_teacherId_date_idx" ON "teaching_sessions"("teacherId", "date");

-- CreateIndex
CREATE INDEX "teaching_sessions_replacementTeacherId_date_idx" ON "teaching_sessions"("replacementTeacherId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "teaching_sessions_scheduleSlotId_date_key" ON "teaching_sessions"("scheduleSlotId", "date");

-- CreateIndex
CREATE INDEX "teaching_session_changes_sessionId_idx" ON "teaching_session_changes"("sessionId");

-- CreateIndex
CREATE INDEX "teacher_pay_adjustments_schoolId_month_idx" ON "teacher_pay_adjustments"("schoolId", "month");

-- CreateIndex
CREATE INDEX "teacher_pay_adjustments_teacherId_month_idx" ON "teacher_pay_adjustments"("teacherId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_months_schoolId_month_key" ON "timesheet_months"("schoolId", "month");

-- CreateIndex
CREATE INDEX "teacher_notifications_teacherId_createdAt_idx" ON "teacher_notifications"("teacherId", "createdAt");

-- AddForeignKey
ALTER TABLE "teaching_sessions" ADD CONSTRAINT "teaching_sessions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_sessions" ADD CONSTRAINT "teaching_sessions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_sessions" ADD CONSTRAINT "teaching_sessions_scheduleSlotId_fkey" FOREIGN KEY ("scheduleSlotId") REFERENCES "schedule_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_sessions" ADD CONSTRAINT "teaching_sessions_replacementTeacherId_fkey" FOREIGN KEY ("replacementTeacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_session_changes" ADD CONSTRAINT "teaching_session_changes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_session_changes" ADD CONSTRAINT "teaching_session_changes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "teaching_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_pay_adjustments" ADD CONSTRAINT "teacher_pay_adjustments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_pay_adjustments" ADD CONSTRAINT "teacher_pay_adjustments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_months" ADD CONSTRAINT "timesheet_months_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_notifications" ADD CONSTRAINT "teacher_notifications_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_notifications" ADD CONSTRAINT "teacher_notifications_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

