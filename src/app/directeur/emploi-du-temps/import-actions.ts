"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { UserError, asResult } from "@/lib/user-error";
import { ACTIVITY_ACTIONS, logActivity } from "@/lib/activity";
import { DAY_LABELS_FR, formatTime } from "@/lib/schedule-import";

/**
 * Enregistrement d'un emploi du temps importé (voir lib/schedule-import.ts et
 * schedule-import-dialog.tsx). Le directeur a vu chaque cours et choisi chaque
 * matière avant d'arriver ici. Un cours qui chevauche un autre cours de la
 * classe, un enseignant déjà pris ailleurs ou une salle déjà occupée n'entre
 * pas : il revient dans la liste « non importés », avec sa raison.
 */

const importSchema = z.object({
  classId: z.string().min(1),
  /** Supprimer d'abord les cours actuels de la classe (le pointage déjà fait est gardé). */
  replace: z.boolean(),
  slots: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(1).max(7),
        startMinutes: z.number().int().min(0).max(1439),
        endMinutes: z.number().int().min(1).max(1440),
        subjectId: z.string().min(1),
        room: z.string().trim().max(40).nullable(),
      }),
    )
    .min(1, "Aucun cours à importer.")
    .max(300),
});
export type ScheduleImportInput = z.infer<typeof importSchema>;

interface Busy {
  classId: string;
  className: string;
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  room: string | null;
  teacherId: string | null;
  teacherName: string | null;
  label: string;
}

const overlaps = (a: { dayOfWeek: number; startMinutes: number; endMinutes: number }, b: typeof a) =>
  a.dayOfWeek === b.dayOfWeek && a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
const when = (s: { dayOfWeek: number; startMinutes: number; endMinutes: number }) =>
  `${DAY_LABELS_FR[s.dayOfWeek]} ${formatTime(s.startMinutes)}–${formatTime(s.endMinutes)}`;

export async function importSchedule(input: ScheduleImportInput) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    const data = importSchema.parse(input);

    const cls = await prisma.classRoom.findFirst({
      where: { id: data.classId, schoolId: user.schoolId },
      select: {
        id: true,
        name: true,
        academicYear: { select: { isCurrent: true } },
        classSubjects: { select: { subjectId: true, teacherId: true } },
      },
    });
    if (!cls) throw new UserError("Classe introuvable.");
    if (!cls.academicYear.isCurrent) {
      throw new UserError("Cette classe appartient à une année terminée : son emploi du temps ne se modifie plus.");
    }

    const subjectIds = [...new Set(data.slots.map((s) => s.subjectId))];
    const subjects = await prisma.subject.findMany({
      where: { id: { in: subjectIds }, schoolId: user.schoolId },
      select: { id: true, name: true },
    });
    if (subjects.length !== subjectIds.length) throw new UserError("Une des matières n'existe pas dans l'école.");
    const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
    const teacherOf = new Map(cls.classSubjects.map((cs) => [cs.subjectId, cs.teacherId]));
    const teacherIds = [...new Set(cls.classSubjects.map((cs) => cs.teacherId).filter((id): id is string => id != null))];
    const teachers = await prisma.teacher.findMany({
      where: { id: { in: teacherIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const teacherName = new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`]));

    // Les cours de l'année en cours, les jours concernés : ceux de la classe
    // (sauf s'ils sont remplacés) et ceux des autres classes.
    const existing = await prisma.scheduleSlot.findMany({
      where: {
        classRoom: { schoolId: user.schoolId, academicYear: { isCurrent: true } },
        dayOfWeek: { in: [...new Set(data.slots.map((s) => s.dayOfWeek))] },
        ...(data.replace ? { NOT: { classId: cls.id } } : {}),
      },
      select: {
        classId: true,
        dayOfWeek: true,
        startMinutes: true,
        endMinutes: true,
        room: true,
        classRoom: { select: { name: true } },
        classSubject: {
          select: {
            teacherId: true,
            teacher: { select: { firstName: true, lastName: true } },
            subject: { select: { name: true } },
          },
        },
      },
    });
    const busy: Busy[] = existing.map((s) => ({
      classId: s.classId,
      className: s.classRoom.name,
      dayOfWeek: s.dayOfWeek,
      startMinutes: s.startMinutes,
      endMinutes: s.endMinutes,
      room: s.room,
      teacherId: s.classSubject.teacherId,
      teacherName: s.classSubject.teacher ? `${s.classSubject.teacher.firstName} ${s.classSubject.teacher.lastName}` : null,
      label: s.classSubject.subject.name,
    }));

    const accepted: (ScheduleImportInput["slots"][number] & { room: string | null })[] = [];
    const skipped: { course: string; reason: string }[] = [];
    const sorted = [...data.slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinutes - b.startMinutes);
    for (const slot of sorted) {
      const name = subjectName.get(slot.subjectId)!;
      const course = `${when(slot)} · ${name}`;
      if (slot.endMinutes <= slot.startMinutes) {
        skipped.push({ course, reason: "l'heure de fin est avant l'heure de début" });
        continue;
      }
      const room = slot.room?.trim() || null;
      const teacherId = teacherOf.get(slot.subjectId) ?? null;
      const sameClass = busy.find((b) => b.classId === cls.id && overlaps(b, slot));
      if (sameClass) {
        skipped.push({ course, reason: `la classe a déjà ${sameClass.label} ${when(sameClass)}` });
        continue;
      }
      const teacherClash = teacherId ? busy.find((b) => b.teacherId === teacherId && overlaps(b, slot)) : undefined;
      if (teacherClash) {
        skipped.push({
          course,
          reason: `${teacherName.get(teacherId!) ?? teacherClash.teacherName ?? "l'enseignant"} a déjà cours en ${teacherClash.className} ${when(teacherClash)}`,
        });
        continue;
      }
      const roomClash = room
        ? busy.find((b) => b.room?.toLowerCase() === room.toLowerCase() && overlaps(b, slot))
        : undefined;
      if (roomClash) {
        skipped.push({ course, reason: `la salle ${room} est prise par ${roomClash.className} ${when(roomClash)}` });
        continue;
      }
      accepted.push({ ...slot, room });
      busy.push({
        classId: cls.id,
        className: cls.name,
        ...slot,
        room,
        teacherId,
        teacherName: teacherId ? (teacherName.get(teacherId) ?? null) : null,
        label: name,
      });
    }
    if (accepted.length === 0) {
      throw new UserError(
        skipped.length > 0 ? `Aucun cours importé : ${skipped[0].course} — ${skipped[0].reason}.` : "Aucun cours à importer.",
      );
    }

    // Une matière de l'école que la classe n'avait pas encore : elle lui est
    // ajoutée, sans enseignant (à choisir ensuite dans Classes).
    const added = [...new Set(accepted.map((s) => s.subjectId))].filter((id) => !teacherOf.has(id));

    await prisma.$transaction(async (tx) => {
      if (data.replace) await tx.scheduleSlot.deleteMany({ where: { classId: cls.id } });
      if (added.length > 0) {
        await tx.classSubject.createMany({ data: added.map((subjectId) => ({ classId: cls.id, subjectId })), skipDuplicates: true });
      }
      const links = await tx.classSubject.findMany({ where: { classId: cls.id }, select: { id: true, subjectId: true } });
      const linkOf = new Map(links.map((l) => [l.subjectId, l.id]));
      await tx.scheduleSlot.createMany({
        data: accepted.map((s) => ({
          classId: cls.id,
          classSubjectId: linkOf.get(s.subjectId)!,
          dayOfWeek: s.dayOfWeek,
          startMinutes: s.startMinutes,
          endMinutes: s.endMinutes,
          room: s.room,
        })),
      });
      await logActivity(tx, {
        schoolId: user.schoolId,
        userId: user.id,
        action: ACTIVITY_ACTIONS.SCHEDULE,
        summary:
          `Emploi du temps importé pour ${cls.name} : ${accepted.length} cours` +
          (data.replace ? ", à la place de l'ancien" : "") +
          (added.length > 0 ? ` ; matière(s) ajoutée(s) à la classe : ${added.map((id) => subjectName.get(id)).join(", ")}` : "") +
          (skipped.length > 0 ? ` ; ${skipped.length} cours non importé(s)` : ""),
        href: "/directeur/emploi-du-temps",
      });
    });

    revalidatePath("/directeur/emploi-du-temps");
    revalidatePath("/enseignant/emploi-du-temps");
    return {
      created: accepted.length,
      skipped,
      addedSubjects: added.map((id) => subjectName.get(id)!),
    };
  });
}
