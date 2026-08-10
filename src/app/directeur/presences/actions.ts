"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";

interface AttendanceEntry {
  studentId: string;
  status: string;
}

const VALID_STATUSES = new Set(["PRESENT", "ABSENT", "LATE"]);

export async function saveAttendance(
  classId: string,
  dateISO: string,
  entries: AttendanceEntry[],
) {
  const user = await requireRole(ROLES.DIRECTOR, ROLES.TEACHER);

  const cls = await prisma.classRoom.findFirst({
    where: { id: classId, schoolId: user.schoolId },
  });
  if (!cls) throw new Error("Classe introuvable.");

  // La date est normalisée à minuit UTC : la contrainte d'unicité
  // (studentId, date) ne fonctionne que si toutes les saisies d'un même
  // jour partagent exactement la même valeur.
  const date = new Date(`${dateISO}T00:00:00.000Z`);

  const studentIds = entries.map((e) => e.studentId);
  const studentsInClass = await prisma.student.findMany({
    where: { id: { in: studentIds }, schoolId: user.schoolId, classId },
    select: { id: true },
  });
  const allowedIds = new Set(studentsInClass.map((s) => s.id));

  for (const entry of entries) {
    if (!allowedIds.has(entry.studentId)) continue;
    if (!VALID_STATUSES.has(entry.status)) continue;

    await prisma.attendanceRecord.upsert({
      where: { studentId_date: { studentId: entry.studentId, date } },
      create: {
        schoolId: user.schoolId,
        studentId: entry.studentId,
        classId,
        date,
        status: entry.status,
        markedByUserId: user.id,
      },
      update: { status: entry.status, markedByUserId: user.id },
    });
  }

  revalidatePath("/directeur/presences");
  revalidatePath("/directeur");
}
