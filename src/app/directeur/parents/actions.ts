"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { parentSchema, type ParentFormValues } from "./schema";

async function syncStudentLinks(
  schoolId: string,
  parentId: string,
  studentIds: string[],
) {
  // Sans ce filtre, un studentId d'une autre école lierait le parent à un
  // élève étranger : celui-ci apparaîtrait ensuite en entier (présences,
  // notes, bulletins, frais) dans le portail de ce parent.
  const ownStudents = await prisma.student.findMany({
    where: { id: { in: studentIds }, schoolId },
    select: { id: true },
  });
  const ownStudentIds = new Set(ownStudents.map((s) => s.id));

  const existingLinks = await prisma.studentParent.findMany({
    where: { parentId },
  });
  const existingStudentIds = new Set(existingLinks.map((l) => l.studentId));
  const nextStudentIds = new Set(studentIds.filter((id) => ownStudentIds.has(id)));

  const toRemove = existingLinks.filter((l) => !nextStudentIds.has(l.studentId));
  if (toRemove.length > 0) {
    await prisma.studentParent.deleteMany({
      where: { id: { in: toRemove.map((l) => l.id) } },
    });
  }

  const toAdd = [...nextStudentIds].filter((id) => !existingStudentIds.has(id));
  for (const studentId of toAdd) {
    const hasPrimary = await prisma.studentParent.findFirst({
      where: { studentId, isPrimary: true },
    });
    await prisma.studentParent.create({
      data: { studentId, parentId, isPrimary: !hasPrimary },
    });
  }
}

export async function createParent(values: ParentFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = parentSchema.parse(values);

  const parent = await prisma.parent.create({
    data: {
      schoolId: user.schoolId,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email || null,
      address: data.address || null,
      relationship: data.relationship || null,
    },
  });

  if (data.studentIds.length > 0) {
    await syncStudentLinks(user.schoolId, parent.id, data.studentIds);
  }

  revalidatePath("/directeur/parents");
  revalidatePath("/directeur/eleves");
}

export async function updateParent(parentId: string, values: ParentFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = parentSchema.parse(values);

  const existing = await prisma.parent.findFirst({
    where: { id: parentId, schoolId: user.schoolId },
  });
  if (!existing) throw new Error("Parent introuvable.");

  await prisma.parent.update({
    where: { id: parentId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email || null,
      address: data.address || null,
      relationship: data.relationship || null,
    },
  });

  await syncStudentLinks(user.schoolId, parentId, data.studentIds);

  revalidatePath("/directeur/parents");
  revalidatePath("/directeur/eleves");
}
