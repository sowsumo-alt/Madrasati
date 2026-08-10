"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { slotSchema, timeToMinutes, type SlotFormValues } from "./schema";

export async function createSlot(values: SlotFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = slotSchema.parse(values);

  const startMinutes = timeToMinutes(data.startTime);
  const endMinutes = timeToMinutes(data.endTime);
  if (endMinutes <= startMinutes) {
    throw new Error("L'heure de fin doit être après l'heure de début.");
  }

  const cls = await prisma.classRoom.findFirst({
    where: { id: data.classId, schoolId: user.schoolId },
  });
  if (!cls) throw new Error("Classe introuvable.");

  await prisma.scheduleSlot.create({
    data: {
      classId: data.classId,
      classSubjectId: data.classSubjectId,
      dayOfWeek: data.dayOfWeek,
      startMinutes,
      endMinutes,
      room: data.room || null,
    },
  });

  revalidatePath("/directeur/emploi-du-temps");
}

export async function deleteSlot(slotId: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  const slot = await prisma.scheduleSlot.findFirst({
    where: { id: slotId },
    include: { classRoom: true },
  });
  if (!slot || slot.classRoom.schoolId !== user.schoolId) {
    throw new Error("Créneau introuvable.");
  }

  await prisma.scheduleSlot.delete({ where: { id: slotId } });
  revalidatePath("/directeur/emploi-du-temps");
}
