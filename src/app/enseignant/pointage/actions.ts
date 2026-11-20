"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { UserError, asResult } from "@/lib/user-error";
import { assertTimesheetEnabled, teacherOfUser } from "@/lib/timesheet-data";
import { checkInResult, checkInWindow, checkPosition, hm, isCheckInOpen } from "@/lib/timesheet";

const positionSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().nonnegative().optional(),
});

/**
 * « Je suis en classe » : tout est revérifié ici, jamais seulement dans le
 * navigateur — la séance est bien à cet enseignant, le pointage est ouvert
 * (10 min avant à 15 min après le début), le téléphone est dans le rayon de
 * l'école. L'heure retenue est celle du serveur.
 */
export async function checkIn(sessionId: string, position: unknown) {
  return asResult(async () => {
    const user = await requireRole(ROLES.TEACHER);
    const school = await assertTimesheetEnabled(user.schoolId);
    const teacher = await teacherOfUser(user.id, user.schoolId);
    if (!teacher) throw new UserError("Votre compte n'est relié à aucune fiche enseignant. Prévenez la direction.");

    const id = z.string().min(1).max(40).parse(sessionId);
    const session = await prisma.teachingSession.findFirst({
      where: { id, schoolId: user.schoolId, teacherId: teacher.id },
      select: { id: true, startsAt: true, status: true },
    });
    if (!session) throw new UserError("Séance introuvable. Rechargez la page.");
    if (session.status === "PRESENT" || session.status === "LATE") throw new UserError("Vous avez déjà pointé pour cette séance.");
    if (session.status !== "PENDING") throw new UserError("Cette séance n'est plus ouverte au pointage.");

    const now = new Date();
    if (!isCheckInOpen(session.startsAt, now)) {
      const { opensAt, closesAt } = checkInWindow(session.startsAt);
      throw new UserError(`Le pointage de cette séance est ouvert de ${hm(opensAt)} à ${hm(closesAt)}.`);
    }

    const parsed = positionSchema.safeParse(position);
    if (!parsed.success) throw new UserError("Position introuvable : autorisez la localisation du téléphone puis réessayez.");
    const where = checkPosition({ latitude: school.latitude, longitude: school.longitude, radius: school.radius }, parsed.data);
    if (!where.ok) {
      throw new UserError(
        where.reason === "NOT_CONFIGURED"
          ? "La position de l'école n'est pas encore enregistrée. Prévenez la direction."
          : where.reason === "TOO_FAR"
            ? `Vous êtes à ${where.distance} m de l'école : le pointage se fait depuis l'école (moins de ${school.radius} m).`
            : "Position illisible : réessayez.",
      );
    }

    const result = checkInResult(session.startsAt, now);
    // Conditionnel : deux appuis rapprochés ne pointent qu'une fois.
    const updated = await prisma.teachingSession.updateMany({
      where: { id: session.id, status: "PENDING" },
      data: {
        status: result.status,
        lateMinutes: result.lateMinutes,
        checkedInAt: now,
        checkInLat: parsed.data.latitude,
        checkInLng: parsed.data.longitude,
        checkInDistance: where.distance,
      },
    });
    if (updated.count === 0) throw new UserError("Vous avez déjà pointé pour cette séance.");

    revalidatePath("/enseignant");
    revalidatePath("/enseignant/pointage");
    return { status: result.status, lateMinutes: result.lateMinutes, at: now.toISOString() };
  });
}

/** Les messages de la direction sont lus : la cloche s'éteint. */
export async function markTeacherNotificationsRead() {
  return asResult(async () => {
    const user = await requireRole(ROLES.TEACHER);
    const teacher = await teacherOfUser(user.id, user.schoolId);
    if (!teacher) return {};
    await prisma.teacherNotification.updateMany({
      where: { schoolId: user.schoolId, teacherId: teacher.id, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath("/enseignant", "layout");
    return {};
  });
}
