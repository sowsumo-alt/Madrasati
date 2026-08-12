"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { getTeacherScope } from "@/lib/teacher-scope";
import { teacherSlotSchema, timeToMinutes, type TeacherSlotFormValues } from "./schema";

export async function createTeacherSlot(values: TeacherSlotFormValues) {
  const user = await requireRole(ROLES.TEACHER);
  const data = teacherSlotSchema.parse(values);

  const scope = await getTeacherScope(user.id, user.schoolId);
  if (!scope) throw new Error("Profil enseignant introuvable.");

  // Le classSubject doit appartenir à cet enseignant : impossible d'ajouter
  // un créneau sur une matière assurée par un collègue.
  const classSubject = await prisma.classSubject.findFirst({
    where: { id: data.classSubjectId, teacherId: scope.teacher.id },
  });
  if (!classSubject) throw new Error("Cette matière ne vous est pas assignée.");

  const startMinutes = timeToMinutes(data.startTime);
  const endMinutes = timeToMinutes(data.endTime);
  if (endMinutes <= startMinutes) {
    throw new Error("L'heure de fin doit être après l'heure de début.");
  }

  await prisma.scheduleSlot.create({
    data: {
      classId: classSubject.classId,
      classSubjectId: classSubject.id,
      dayOfWeek: data.dayOfWeek,
      startMinutes,
      endMinutes,
      room: data.room || null,
    },
  });

  revalidatePath("/enseignant/emploi-du-temps");
  revalidatePath("/directeur/emploi-du-temps");
}

export async function deleteTeacherSlot(slotId: string) {
  const user = await requireRole(ROLES.TEACHER);
  const scope = await getTeacherScope(user.id, user.schoolId);
  if (!scope) throw new Error("Profil enseignant introuvable.");

  const slot = await prisma.scheduleSlot.findFirst({
    where: { id: slotId, classSubject: { teacherId: scope.teacher.id } },
  });
  if (!slot) throw new Error("Créneau introuvable.");

  await prisma.scheduleSlot.delete({ where: { id: slotId } });
  revalidatePath("/enseignant/emploi-du-temps");
  revalidatePath("/directeur/emploi-du-temps");
}
