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

  // La matière doit appartenir à cette classe : sans ce contrôle, un
  // classSubjectId d'une autre classe (voire d'une autre école) pouvait être
  // programmé ici et faire apparaître son enseignant dans cet emploi du temps.
  const classSubject = await prisma.classSubject.findFirst({
    where: { id: data.classSubjectId, classId: data.classId },
    select: { id: true, teacherId: true, subject: { select: { name: true } } },
  });
  if (!classSubject) throw new Error("Matière introuvable pour cette classe.");

  await assertNoConflict({
    schoolId: user.schoolId,
    dayOfWeek: data.dayOfWeek,
    startMinutes,
    endMinutes,
    teacherId: classSubject.teacherId,
    room: data.room || null,
  });

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
  revalidatePath("/enseignant/emploi-du-temps");
}

const DAY_LABELS = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi"];

function formatMinutes(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}h${String(m % 60).padStart(2, "0")}`;
}

/**
 * Refuse un créneau qui superpose un enseignant ou une salle déjà occupés.
 *
 * Deux créneaux se chevauchent dès que l'un commence avant que l'autre ne
 * finisse ; l'égalité stricte est autorisée, pour qu'un cours puisse enchaîner
 * exactement à la fin du précédent.
 */
async function assertNoConflict(input: {
  schoolId: string;
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  teacherId: string | null;
  room: string | null;
}) {
  const sameSlot = {
    dayOfWeek: input.dayOfWeek,
    startMinutes: { lt: input.endMinutes },
    endMinutes: { gt: input.startMinutes },
    classRoom: { schoolId: input.schoolId },
  };

  if (input.teacherId) {
    const clash = await prisma.scheduleSlot.findFirst({
      where: { ...sameSlot, classSubject: { teacherId: input.teacherId } },
      select: {
        startMinutes: true,
        endMinutes: true,
        classRoom: { select: { name: true } },
        classSubject: {
          select: { teacher: { select: { firstName: true, lastName: true } } },
        },
      },
    });
    if (clash) {
      const t = clash.classSubject.teacher;
      throw new Error(
        `${t ? `${t.firstName} ${t.lastName}` : "Cet enseignant"} a déjà cours en ${clash.classRoom.name} le ${DAY_LABELS[input.dayOfWeek] ?? ""} de ${formatMinutes(clash.startMinutes)} à ${formatMinutes(clash.endMinutes)}.`,
      );
    }
  }

  const room = input.room?.trim();
  if (room) {
    const clash = await prisma.scheduleSlot.findFirst({
      where: { ...sameSlot, room: { equals: room, mode: "insensitive" } },
      select: {
        startMinutes: true,
        endMinutes: true,
        classRoom: { select: { name: true } },
      },
    });
    if (clash) {
      throw new Error(
        `La salle ${room} est déjà occupée par la classe ${clash.classRoom.name} le ${DAY_LABELS[input.dayOfWeek] ?? ""} de ${formatMinutes(clash.startMinutes)} à ${formatMinutes(clash.endMinutes)}.`,
      );
    }
  }
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
