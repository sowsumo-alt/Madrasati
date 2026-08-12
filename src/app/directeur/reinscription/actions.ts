"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";

async function getCurrentAcademicYear(schoolId: string) {
  const year = await prisma.academicYear.findFirst({
    where: { schoolId, isCurrent: true },
  });
  if (!year) throw new Error("Aucune année scolaire active.");
  return year;
}

async function getTargetClass(schoolId: string, targetClassId: string) {
  const year = await getCurrentAcademicYear(schoolId);
  const targetClass = await prisma.classRoom.findFirst({
    where: { id: targetClassId, schoolId, academicYearId: year.id },
  });
  if (!targetClass) throw new Error("Classe de destination invalide.");
  return targetClass;
}

export async function reenrollStudent(studentId: string, targetClassId: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  const targetClass = await getTargetClass(user.schoolId, targetClassId);

  await prisma.student.updateMany({
    where: { id: studentId, schoolId: user.schoolId },
    data: { classId: targetClass.id, status: "ACTIVE" },
  });

  revalidatePath("/directeur/reinscription");
  revalidatePath("/directeur/eleves");
  revalidatePath("/directeur");
}

export async function reenrollClass(sourceClassId: string, targetClassId: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  const targetClass = await getTargetClass(user.schoolId, targetClassId);

  await prisma.student.updateMany({
    where: { schoolId: user.schoolId, classId: sourceClassId, status: "ACTIVE" },
    data: { classId: targetClass.id },
  });

  revalidatePath("/directeur/reinscription");
  revalidatePath("/directeur/eleves");
  revalidatePath("/directeur");
}

export async function markNotReenrolled(studentId: string) {
  const user = await requireRole(ROLES.DIRECTOR);

  await prisma.student.updateMany({
    where: { id: studentId, schoolId: user.schoolId },
    data: { status: "INACTIVE" },
  });

  revalidatePath("/directeur/reinscription");
  revalidatePath("/directeur/eleves");
  revalidatePath("/directeur");
}
