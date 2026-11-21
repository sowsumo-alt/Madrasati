"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { UserError, asResult } from "@/lib/user-error";
import { ACTIVITY_ACTIONS, logActivity } from "@/lib/activity";
import { requiredDateSchema } from "@/lib/iso-date";
import { formatMRU } from "@/lib/format";
import { assertTimesheetEnabled, lockedMonth, monthPayroll, notifyTeacher } from "@/lib/timesheet-data";
import {
  CORRECTABLE_STATUSES,
  STATUS_LABELS,
  daysBetween,
  dmy,
  effectiveStatus,
  hm,
  monthKeyOf,
  monthLabelOf,
  monthRange,
  sessionMinutes,
  startOfDayUtc,
  timesheetSwitchData,
  type SessionStatus,
} from "@/lib/timesheet";

const id = z.string().min(1).max(40);
const monthKey = z.string().regex(/^\d{4}-\d{2}$/);

function refresh() {
  revalidatePath("/directeur/pointage", "layout");
  revalidatePath("/enseignant", "layout");
}

async function assertMonthOpen(schoolId: string, month: Date) {
  const lock = await lockedMonth(schoolId, month);
  if (lock?.lockedAt) {
    throw new UserError(`La paie de ${monthLabelOf(monthKeyOf(month))} est validée : déverrouillez-la d'abord (Paie du mois).`);
  }
}

const correctionSchema = z.object({
  status: z.enum(CORRECTABLE_STATUSES),
  lateMinutes: z.coerce.number().int().min(1).max(600).optional(),
  replacementTeacherId: id.optional().or(z.literal("")),
  observation: z.string().trim().max(300).optional().or(z.literal("")),
});
export type SessionCorrection = z.infer<typeof correctionSchema>;

/**
 * Correction d'une séance par la direction : statut, retard, remplaçant
 * (les heures vont alors à lui), observation. Chaque correction est gardée
 * (qui, quand, ancien → nouveau) et l'enseignant est prévenu.
 */
export async function correctSession(sessionId: string, values: SessionCorrection) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    await assertTimesheetEnabled(user.schoolId);
    const data = correctionSchema.parse(values);
    const session = await prisma.teachingSession.findFirst({
      where: { id: id.parse(sessionId), schoolId: user.schoolId },
      select: {
        id: true,
        teacherId: true,
        date: true,
        startsAt: true,
        endsAt: true,
        status: true,
        lateMinutes: true,
        className: true,
        subjectName: true,
        observation: true,
        replacementTeacher: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!session) throw new UserError("Séance introuvable. Rechargez la page.");
    await assertMonthOpen(user.schoolId, new Date(Date.UTC(session.date.getUTCFullYear(), session.date.getUTCMonth(), 1)));

    let replacement: { id: string; firstName: string; lastName: string } | null = null;
    if (data.status === "REPLACED") {
      if (!data.replacementTeacherId) throw new UserError("Choisissez l'enseignant remplaçant.");
      if (data.replacementTeacherId === session.teacherId) throw new UserError("Le remplaçant doit être un autre enseignant.");
      replacement = await prisma.teacher.findFirst({
        where: { id: data.replacementTeacherId, schoolId: user.schoolId },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!replacement) throw new UserError("Enseignant remplaçant introuvable.");
    }
    const duration = sessionMinutes(session);
    const lateMinutes = data.status === "LATE" ? Math.min(data.lateMinutes ?? session.lateMinutes ?? 0, duration) : 0;
    if (data.status === "LATE" && lateMinutes < 1) throw new UserError("Indiquez les minutes de retard.");

    const fromStatus = effectiveStatus(session, new Date());
    const nameOf = (t: { firstName: string; lastName: string } | null) => (t ? `${t.firstName} ${t.lastName}`.trim() : null);
    const observation = data.observation?.trim() || null;
    const label = `${session.className} · ${session.subjectName} · ${dmy(session.startsAt)} ${hm(session.startsAt)}`;
    const toLabel =
      data.status === "REPLACED" ? `Remplacé par ${nameOf(replacement)}` : data.status === "LATE" ? `Retard (${lateMinutes} min)` : STATUS_LABELS[data.status];

    await prisma.$transaction(async (tx) => {
      await tx.teachingSession.update({
        where: { id: session.id },
        data: {
          status: data.status,
          lateMinutes,
          replacementTeacherId: replacement?.id ?? null,
          observation,
        },
      });
      await tx.teachingSessionChange.create({
        data: {
          schoolId: user.schoolId,
          sessionId: session.id,
          userName: user.name ?? "Direction",
          fromStatus,
          toStatus: data.status,
          fromReplacement: nameOf(session.replacementTeacher),
          toReplacement: nameOf(replacement),
          observation,
        },
      });
      await notifyTeacher(tx, {
        schoolId: user.schoolId,
        teacherId: session.teacherId,
        title: "Statut de séance modifié",
        body: `${label} : ${STATUS_LABELS[fromStatus as SessionStatus] ?? fromStatus} → ${toLabel}${observation ? ` (${observation})` : ""}.`,
      });
      if (replacement) {
        await notifyTeacher(tx, {
          schoolId: user.schoolId,
          teacherId: replacement.id,
          title: "Remplacement enregistré",
          body: `Vous êtes noté remplaçant : ${label}. Ces heures comptent sur votre paie.`,
        });
      }
      await logActivity(tx, {
        schoolId: user.schoolId,
        userId: user.id,
        action: ACTIVITY_ACTIONS.TIMESHEET,
        summary: `Séance ${label} : ${STATUS_LABELS[fromStatus as SessionStatus] ?? fromStatus} → ${toLabel}`,
        href: `/directeur/pointage?jour=${session.date.toISOString().slice(0, 10)}`,
      });
    });
    refresh();
    return {};
  });
}

/** Historique des corrections d'une séance (fenêtre de correction). */
export async function sessionHistory(sessionId: string) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    const changes = await prisma.teachingSessionChange.findMany({
      where: { schoolId: user.schoolId, sessionId: id.parse(sessionId) },
      orderBy: { createdAt: "desc" },
      select: { id: true, userName: true, fromStatus: true, toStatus: true, toReplacement: true, observation: true, createdAt: true },
    });
    return { changes: changes.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })) };
  });
}

/** Taux horaire d'un enseignant (MRU entiers) ; vide = non renseigné. */
export async function setHourlyRate(teacherId: string, rate: number | null) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    await assertTimesheetEnabled(user.schoolId);
    const value = rate == null ? null : z.number().int().min(0).max(1_000_000).parse(rate);
    const teacher = await prisma.teacher.findFirst({ where: { id: id.parse(teacherId), schoolId: user.schoolId }, select: { id: true } });
    if (!teacher) throw new UserError("Enseignant introuvable.");
    await prisma.teacher.update({ where: { id: teacher.id }, data: { hourlyRate: value } });
    refresh();
    return {};
  });
}

const adjustmentSchema = z.object({
  teacherId: id,
  month: monthKey,
  kind: z.enum(["ADVANCE", "OTHER"]),
  amount: z.coerce.number().int().positive("Le montant doit être positif").max(10_000_000),
  reason: z.string().trim().min(2, "Indiquez le motif").max(200),
});
export type AdjustmentValues = z.infer<typeof adjustmentSchema>;

/** Avance ou autre déduction sur la paie d'un mois (refusée si la paie est validée). */
export async function addPayAdjustment(values: AdjustmentValues) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    await assertTimesheetEnabled(user.schoolId);
    const data = adjustmentSchema.parse(values);
    const month = monthRange(data.month)!.start;
    await assertMonthOpen(user.schoolId, month);
    const teacher = await prisma.teacher.findFirst({
      where: { id: data.teacherId, schoolId: user.schoolId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!teacher) throw new UserError("Enseignant introuvable.");
    await prisma.$transaction(async (tx) => {
      await tx.teacherPayAdjustment.create({
        data: { schoolId: user.schoolId, teacherId: teacher.id, month, kind: data.kind, amount: data.amount, reason: data.reason, createdByName: user.name ?? "Direction" },
      });
      await logActivity(tx, {
        schoolId: user.schoolId,
        userId: user.id,
        action: ACTIVITY_ACTIONS.TIMESHEET,
        summary: `${data.kind === "ADVANCE" ? "Avance" : "Déduction"} de ${formatMRU(data.amount)} pour ${teacher.firstName} ${teacher.lastName} (${monthLabelOf(data.month)}) : ${data.reason}`,
        amount: data.amount,
      });
    });
    refresh();
    return {};
  });
}

export async function deletePayAdjustment(adjustmentId: string) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    await assertTimesheetEnabled(user.schoolId);
    const adjustment = await prisma.teacherPayAdjustment.findFirst({
      where: { id: id.parse(adjustmentId), schoolId: user.schoolId },
      select: { id: true, month: true, amount: true, reason: true, teacher: { select: { firstName: true, lastName: true } } },
    });
    if (!adjustment) throw new UserError("Déduction introuvable.");
    await assertMonthOpen(user.schoolId, adjustment.month);
    await prisma.$transaction(async (tx) => {
      await tx.teacherPayAdjustment.delete({ where: { id: adjustment.id } });
      await logActivity(tx, {
        schoolId: user.schoolId,
        userId: user.id,
        action: ACTIVITY_ACTIONS.TIMESHEET,
        summary: `Déduction retirée (${formatMRU(adjustment.amount)}, ${adjustment.reason}) pour ${adjustment.teacher.firstName} ${adjustment.teacher.lastName}`,
      });
    });
    refresh();
    return {};
  });
}

/** Valider la paie du mois : les montants sont figés, plus rien ne change sans déverrouillage tracé. */
export async function validateMonth(key: string) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    await assertTimesheetEnabled(user.schoolId);
    const range = monthRange(monthKey.parse(key))!;
    await assertMonthOpen(user.schoolId, range.start);
    // Un mois pas encore fini peut être validé (paie anticipée) : les séances à venir n'y comptent pas.
    const now = new Date();
    const payroll = await monthPayroll(user.schoolId, range.key, now);
    await prisma.$transaction(async (tx) => {
      await tx.timesheetMonth.upsert({
        where: { schoolId_month: { schoolId: user.schoolId, month: range.start } },
        create: { schoolId: user.schoolId, month: range.start, lockedAt: now, lockedByName: user.name ?? "Direction", snapshot: payroll.lines as object[] },
        update: { lockedAt: now, lockedByName: user.name ?? "Direction", snapshot: payroll.lines as object[] },
      });
      for (const line of payroll.lines) {
        await notifyTeacher(tx, {
          schoolId: user.schoolId,
          teacherId: line.teacherId,
          title: `Paie de ${monthLabelOf(range.key)} validée`,
          body: `Net à payer : ${formatMRU(line.net)} (honoraires ${formatMRU(line.honoraires)}, déductions ${formatMRU(line.deductions)}).`,
        });
      }
      await logActivity(tx, {
        schoolId: user.schoolId,
        userId: user.id,
        action: ACTIVITY_ACTIONS.TIMESHEET,
        summary: `Paie du pointage de ${monthLabelOf(range.key)} validée : ${payroll.lines.length} enseignant(s), net total ${formatMRU(payroll.totals.net)}`,
        amount: payroll.totals.net,
        href: `/directeur/pointage/paie?mois=${range.key}`,
      });
    });
    refresh();
    return {};
  });
}

/** Déverrouiller une paie validée : motif obligatoire, inscrit au journal. */
export async function unlockMonth(key: string, reason: string) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    await assertTimesheetEnabled(user.schoolId);
    const range = monthRange(monthKey.parse(key))!;
    const why = z.string().trim().min(3, "Indiquez le motif du déverrouillage").max(200).parse(reason);
    const lock = await lockedMonth(user.schoolId, range.start);
    if (!lock?.lockedAt) throw new UserError("Cette paie n'est pas validée.");
    await prisma.$transaction(async (tx) => {
      await tx.timesheetMonth.update({
        where: { schoolId_month: { schoolId: user.schoolId, month: range.start } },
        data: { lockedAt: null, lockedByName: null },
      });
      await logActivity(tx, {
        schoolId: user.schoolId,
        userId: user.id,
        action: ACTIVITY_ACTIONS.TIMESHEET,
        summary: `Paie du pointage de ${monthLabelOf(range.key)} déverrouillée (validée le ${dmy(lock.lockedAt!)} par ${lock.lockedByName ?? "?"}) : ${why}`,
        href: `/directeur/pointage/paie?mois=${range.key}`,
      });
    });
    refresh();
    return {};
  });
}

const nonWorkingSchema = z.object({
  name: z.string().trim().min(2, "Indiquez le motif (ex. : Vacances d'hiver)").max(80),
  from: requiredDateSchema("La date de début est requise", "Début", { min: "2020-01-01", daysAfterToday: 2 * 366 }),
  to: requiredDateSchema("La date de fin est requise", "Fin", { min: "2020-01-01", daysAfterToday: 2 * 366 }),
});
export type NonWorkingValues = z.infer<typeof nonWorkingSchema>;

/** Jours non travaillés (férié, vacances) : aucune séance attendue ces jours-là. */
export async function addNonWorkingDays(values: NonWorkingValues) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    const data = nonWorkingSchema.parse(values);
    const from = new Date(`${data.from}T00:00:00Z`);
    const to = new Date(`${data.to}T00:00:00Z`);
    if (to < from) throw new UserError("La fin doit être après le début.");
    const days = daysBetween(from, to);
    if (days.length > 120) throw new UserError("Période trop longue (120 jours au plus).");
    const existing = new Set(
      (
        await prisma.holiday.findMany({
          where: { OR: [{ schoolId: user.schoolId }, { schoolId: null }], date: { gte: from, lte: to } },
          select: { date: true },
        })
      ).map((h) => h.date.toISOString().slice(0, 10)),
    );
    const fresh = days.filter((d) => !existing.has(d.toISOString().slice(0, 10)));
    await prisma.$transaction(async (tx) => {
      if (fresh.length) {
        await tx.holiday.createMany({ data: fresh.map((date) => ({ schoolId: user.schoolId, name: data.name, date })) });
      }
      // Séances déjà générées ces jours-là et jamais pointées : elles ne sont plus attendues.
      await tx.teachingSession.deleteMany({
        where: { schoolId: user.schoolId, date: { gte: from, lte: to }, status: { in: ["PENDING", "ABSENT"] }, checkedInAt: null, changes: { none: {} } },
      });
      await logActivity(tx, {
        schoolId: user.schoolId,
        userId: user.id,
        action: ACTIVITY_ACTIONS.TIMESHEET,
        summary: `Jours non travaillés ajoutés : ${data.name}, du ${dmy(from)} au ${dmy(to)}`,
      });
    });
    refresh();
    revalidatePath("/directeur/emploi-du-temps");
    return { added: fresh.length };
  });
}

export async function deleteNonWorkingDay(holidayId: string) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    const holiday = await prisma.holiday.findFirst({ where: { id: id.parse(holidayId), schoolId: user.schoolId }, select: { id: true, name: true, date: true } });
    if (!holiday) throw new UserError("Jour introuvable (les jours fériés nationaux ne se retirent pas).");
    const school = await prisma.school.findUnique({ where: { id: user.schoolId }, select: { timesheetGeneratedThrough: true } });
    const dayBefore = new Date(holiday.date.getTime() - 24 * 60 * 60_000);
    // Un jour passé qui redevient travaillé : ses séances seront générées à nouveau.
    const regenerate = holiday.date <= startOfDayUtc(new Date()) && school?.timesheetGeneratedThrough && dayBefore < school.timesheetGeneratedThrough;
    await prisma.$transaction(async (tx) => {
      await tx.holiday.delete({ where: { id: holiday.id } });
      if (regenerate) await tx.school.update({ where: { id: user.schoolId }, data: { timesheetGeneratedThrough: dayBefore } });
      await logActivity(tx, {
        schoolId: user.schoolId,
        userId: user.id,
        action: ACTIVITY_ACTIONS.TIMESHEET,
        summary: `Jour non travaillé retiré : ${holiday.name}, ${dmy(holiday.date)}`,
      });
    });
    refresh();
    revalidatePath("/directeur/emploi-du-temps");
    return {};
  });
}

/**
 * Le directeur active (ou coupe) lui-même le module pour son école.
 * Couper ne supprime rien : séances, paies et fiches restent, et reviennent à la réactivation.
 */
export async function setTimesheetEnabled(enabled: boolean) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    const on = z.boolean().parse(enabled);
    const school = await prisma.school.findUnique({ where: { id: user.schoolId }, select: { timesheetStartDate: true } });
    if (!school) throw new UserError("École introuvable.");
    await prisma.$transaction(async (tx) => {
      await tx.school.update({ where: { id: user.schoolId }, data: timesheetSwitchData(on, school.timesheetStartDate, new Date()) });
      await logActivity(tx, {
        schoolId: user.schoolId,
        userId: user.id,
        action: ACTIVITY_ACTIONS.TIMESHEET,
        summary: on ? "Module Pointage des enseignants activé" : "Module Pointage des enseignants désactivé",
      });
    });
    revalidatePath("/directeur", "layout");
    revalidatePath("/enseignant", "layout");
    return {};
  });
}

const settingsSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).nullable(),
  longitude: z.coerce.number().min(-180).max(180).nullable(),
  radius: z.coerce.number().int().min(30, "30 m au moins").max(2000, "2 000 m au plus"),
  lateDeduction: z.enum(["PRORATA", "NONE"]),
});
export type TimesheetSettingsValues = z.infer<typeof settingsSchema>;

/** Paramètres du pointage : position de l'école, rayon, règle des retards. */
export async function saveTimesheetSettings(values: TimesheetSettingsValues) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    await assertTimesheetEnabled(user.schoolId);
    const data = settingsSchema.parse(values);
    if ((data.latitude == null) !== (data.longitude == null)) throw new UserError("Renseignez la latitude et la longitude ensemble.");
    await prisma.school.update({
      where: { id: user.schoolId },
      data: { latitude: data.latitude, longitude: data.longitude, checkInRadius: data.radius, lateDeduction: data.lateDeduction },
    });
    refresh();
    revalidatePath("/directeur/parametres");
    return {};
  });
}
