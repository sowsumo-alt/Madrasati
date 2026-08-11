"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { classSchema, subjectSchema, type ClassFormValues, type SubjectFormValues } from "./schema";

async function getCurrentAcademicYear(schoolId: string) {
  const year = await prisma.academicYear.findFirst({
    where: { schoolId, isCurrent: true },
  });
  if (!year) throw new Error("Aucune année scolaire active.");
  return year;
}

export async function createClass(values: ClassFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = classSchema.parse(values);
  const year = await getCurrentAcademicYear(user.schoolId);

  await prisma.classRoom.create({
    data: {
      schoolId: user.schoolId,
      academicYearId: year.id,
      name: data.name,
      level: data.level,
      capacity: data.capacity,
      mainTeacherId: data.mainTeacherId || null,
    },
  });

  revalidatePath("/directeur/classes");
  revalidatePath("/directeur");
}

export async function updateClass(classId: string, values: ClassFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = classSchema.parse(values);

  await prisma.classRoom.updateMany({
    where: { id: classId, schoolId: user.schoolId },
    data: {
      name: data.name,
      level: data.level,
      capacity: data.capacity,
      mainTeacherId: data.mainTeacherId || null,
    },
  });

  revalidatePath("/directeur/classes");
  revalidatePath("/directeur");
}

export async function deleteClass(classId: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  const cls = await prisma.classRoom.findFirst({
    where: { id: classId, schoolId: user.schoolId },
    include: { _count: { select: { students: true } } },
  });
  if (!cls) throw new Error("Classe introuvable.");
  if (cls._count.students > 0) {
    throw new Error(
      "Impossible de supprimer une classe qui contient encore des élèves.",
    );
  }

  await prisma.classRoom.delete({ where: { id: classId } });
  revalidatePath("/directeur/classes");
  revalidatePath("/directeur");
}

export async function createSubject(values: SubjectFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = subjectSchema.parse(values);

  await prisma.subject.create({
    data: {
      schoolId: user.schoolId,
      name: data.name,
      nameAr: data.nameAr || null,
      coefficient: data.coefficient,
    },
  });

  revalidatePath("/directeur/classes");
}

export async function updateSubject(subjectId: string, values: SubjectFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = subjectSchema.parse(values);

  await prisma.subject.updateMany({
    where: { id: subjectId, schoolId: user.schoolId },
    data: {
      name: data.name,
      nameAr: data.nameAr || null,
      coefficient: data.coefficient,
    },
  });

  revalidatePath("/directeur/classes");
}

export async function setSubjectActive(subjectId: string, isActive: boolean) {
  const user = await requireRole(ROLES.DIRECTOR);
  await prisma.subject.updateMany({
    where: { id: subjectId, schoolId: user.schoolId },
    data: { isActive },
  });
  revalidatePath("/directeur/classes");
}

export async function assignSubjectToClass(
  classId: string,
  subjectId: string,
  teacherId: string | null,
) {
  const user = await requireRole(ROLES.DIRECTOR);

  const cls = await prisma.classRoom.findFirst({
    where: { id: classId, schoolId: user.schoolId },
  });
  if (!cls) throw new Error("Classe introuvable.");

  await prisma.classSubject.upsert({
    where: { classId_subjectId: { classId, subjectId } },
    create: { classId, subjectId, teacherId },
    update: { teacherId },
  });

  revalidatePath("/directeur/classes");
}

export async function removeSubjectFromClass(classId: string, subjectId: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  const cls = await prisma.classRoom.findFirst({
    where: { id: classId, schoolId: user.schoolId },
  });
  if (!cls) throw new Error("Classe introuvable.");

  await prisma.classSubject.deleteMany({ where: { classId, subjectId } });
  revalidatePath("/directeur/classes");
}
