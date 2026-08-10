"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { teacherSchema, type TeacherFormValues } from "./schema";

export async function createTeacher(values: TeacherFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = teacherSchema.parse(values);

  await prisma.teacher.create({
    data: {
      schoolId: user.schoolId,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email || null,
      diploma: data.diploma || null,
      subjectSpecialty: data.subjectSpecialty || null,
      monthlySalary: data.monthlySalary ? Number(data.monthlySalary) : null,
      hireDate: data.hireDate ? new Date(data.hireDate) : null,
      status: data.status,
    },
  });

  revalidatePath("/directeur/enseignants");
  revalidatePath("/directeur");
}

export async function updateTeacher(teacherId: string, values: TeacherFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = teacherSchema.parse(values);

  await prisma.teacher.updateMany({
    where: { id: teacherId, schoolId: user.schoolId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email || null,
      diploma: data.diploma || null,
      subjectSpecialty: data.subjectSpecialty || null,
      monthlySalary: data.monthlySalary ? Number(data.monthlySalary) : null,
      hireDate: data.hireDate ? new Date(data.hireDate) : null,
      status: data.status,
    },
  });

  revalidatePath("/directeur/enseignants");
  revalidatePath("/directeur");
}

export async function setTeacherStatus(teacherId: string, status: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  await prisma.teacher.updateMany({
    where: { id: teacherId, schoolId: user.schoolId },
    data: { status },
  });
  revalidatePath("/directeur/enseignants");
  revalidatePath("/directeur");
}
