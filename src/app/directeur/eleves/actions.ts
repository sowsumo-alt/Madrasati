"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { studentSchema, type StudentFormValues } from "./schema";

export async function createStudent(values: StudentFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = studentSchema.parse(values);

  const student = await prisma.student.create({
    data: {
      schoolId: user.schoolId,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      gender: data.gender || null,
      classId: data.classId || null,
      status: data.status,
    },
  });

  if (data.parentFirstName && data.parentLastName && data.parentPhone) {
    const parent = await prisma.parent.create({
      data: {
        schoolId: user.schoolId,
        firstName: data.parentFirstName,
        lastName: data.parentLastName,
        phone: data.parentPhone,
        relationship: "tuteur",
      },
    });
    await prisma.studentParent.create({
      data: { studentId: student.id, parentId: parent.id, isPrimary: true },
    });
  }

  revalidatePath("/directeur/eleves");
  revalidatePath("/directeur");
  return { id: student.id };
}

export async function updateStudent(studentId: string, values: StudentFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = studentSchema.parse(values);

  const existing = await prisma.student.findFirst({
    where: { id: studentId, schoolId: user.schoolId },
    include: { parentLinks: { include: { parent: true } } },
  });
  if (!existing) throw new Error("Élève introuvable.");

  await prisma.student.update({
    where: { id: studentId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      gender: data.gender || null,
      classId: data.classId || null,
      status: data.status,
    },
  });

  if (data.parentFirstName && data.parentLastName && data.parentPhone) {
    const primaryLink = existing.parentLinks.find((l) => l.isPrimary);
    if (primaryLink) {
      await prisma.parent.update({
        where: { id: primaryLink.parentId },
        data: {
          firstName: data.parentFirstName,
          lastName: data.parentLastName,
          phone: data.parentPhone,
        },
      });
    } else {
      const parent = await prisma.parent.create({
        data: {
          schoolId: user.schoolId,
          firstName: data.parentFirstName,
          lastName: data.parentLastName,
          phone: data.parentPhone,
          relationship: "tuteur",
        },
      });
      await prisma.studentParent.create({
        data: { studentId, parentId: parent.id, isPrimary: true },
      });
    }
  }

  revalidatePath("/directeur/eleves");
  revalidatePath("/directeur");
}

export async function setStudentStatus(studentId: string, status: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  await prisma.student.updateMany({
    where: { id: studentId, schoolId: user.schoolId },
    data: { status },
  });
  revalidatePath("/directeur/eleves");
  revalidatePath("/directeur");
}

interface ImportRow {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  className?: string;
}

export async function importStudents(rows: ImportRow[]) {
  const user = await requireRole(ROLES.DIRECTOR);

  const classes = await prisma.classRoom.findMany({
    where: { schoolId: user.schoolId },
    select: { id: true, name: true },
  });
  const classByName = new Map(
    classes.map((c) => [c.name.trim().toLowerCase(), c.id]),
  );

  let created = 0;
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const firstName = row.firstName?.trim();
    const lastName = row.lastName?.trim();

    if (!firstName || !lastName) {
      skipped.push({ row: i + 2, reason: "Prénom ou nom manquant" });
      continue;
    }

    const genderRaw = row.gender?.trim().toUpperCase();
    const gender =
      genderRaw === "M" || genderRaw === "MASCULIN"
        ? "M"
        : genderRaw === "F" || genderRaw === "FEMININ" || genderRaw === "FÉMININ"
          ? "F"
          : null;

    let dateOfBirth: Date | null = null;
    if (row.dateOfBirth) {
      const parsed = new Date(row.dateOfBirth);
      if (!Number.isNaN(parsed.getTime())) dateOfBirth = parsed;
    }

    const classId = row.className
      ? (classByName.get(row.className.trim().toLowerCase()) ?? null)
      : null;

    await prisma.student.create({
      data: {
        schoolId: user.schoolId,
        firstName,
        lastName,
        gender,
        dateOfBirth,
        classId,
        status: "ACTIVE",
      },
    });
    created++;
  }

  revalidatePath("/directeur/eleves");
  revalidatePath("/directeur");
  return { created, skipped };
}
