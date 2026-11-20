import { cache } from "react";
import { basePrisma, prisma, type Db } from "@/lib/prisma";
import { CURRENT_YEAR } from "@/lib/school-year";
import { UserError } from "@/lib/user-error";
import {
  computeTeacherPay,
  daysBetween,
  dayKey,
  isLateDeduction,
  monthRange,
  plannedSessions,
  startOfDayUtc,
  type LateDeduction,
  type PlannedSlot,
  type TeacherPay,
} from "@/lib/timesheet";

const DAY = 24 * 60 * 60_000;
/** Une séance qui commence dans moins de 15 min ne bouge plus : l'enseignant peut déjà pointer. */
const FROZEN_BEFORE_START = 15 * 60_000;

export interface TimesheetSchool {
  enabled: boolean;
  startDate: Date | null;
  generatedThrough: Date | null;
  latitude: number | null;
  longitude: number | null;
  radius: number;
  lateDeduction: LateDeduction;
}

/** Réglages du module de l'école, lus une fois par requête. */
export const loadTimesheetSchool = cache(async (schoolId: string): Promise<TimesheetSchool | null> => {
  const s = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      timesheetEnabled: true,
      timesheetStartDate: true,
      timesheetGeneratedThrough: true,
      latitude: true,
      longitude: true,
      checkInRadius: true,
      lateDeduction: true,
    },
  });
  if (!s) return null;
  return {
    enabled: s.timesheetEnabled,
    startDate: s.timesheetStartDate,
    generatedThrough: s.timesheetGeneratedThrough,
    latitude: s.latitude,
    longitude: s.longitude,
    radius: s.checkInRadius,
    lateDeduction: isLateDeduction(s.lateDeduction) ? s.lateDeduction : "PRORATA",
  };
});

/** Pour une action : le module doit être activé pour l'école (module payant). */
export async function assertTimesheetEnabled(schoolId: string): Promise<TimesheetSchool> {
  const school = await loadTimesheetSchool(schoolId);
  if (!school?.enabled) throw new UserError("Le module Pointage n'est pas activé pour votre école.");
  return school;
}

/** La fiche enseignant d'un compte (null : compte non relié à un enseignant). */
export async function teacherOfUser(userId: string, schoolId: string) {
  return prisma.teacher.findFirst({
    where: { userId, schoolId },
    select: { id: true, firstName: true, lastName: true, hourlyRate: true },
  });
}

async function plannedSlots(schoolId: string): Promise<PlannedSlot[]> {
  const slots = await prisma.scheduleSlot.findMany({
    where: { classRoom: { schoolId, ...CURRENT_YEAR } },
    select: {
      id: true,
      dayOfWeek: true,
      startMinutes: true,
      endMinutes: true,
      classId: true,
      classRoom: { select: { name: true } },
      classSubject: { select: { teacherId: true, subject: { select: { name: true } } } },
    },
  });
  return slots.map((s) => ({
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    startMinutes: s.startMinutes,
    endMinutes: s.endMinutes,
    classId: s.classId,
    className: s.classRoom.name,
    subjectName: s.classSubject.subject.name,
    teacherId: s.classSubject.teacherId,
  }));
}

/**
 * Les séances attendues, tirées de l'emploi du temps, jusqu'à aujourd'hui :
 * - chaque jour passé depuis l'activation n'est généré qu'une fois (repère
 *   timesheetGeneratedThrough) ;
 * - aujourd'hui suit l'emploi du temps (créneau ajouté, déplacé, supprimé,
 *   jour férié ajouté) tant que la séance n'a pas commencé — au plus tard
 *   15 min avant, quand le pointage s'ouvre ;
 * - une séance terminée sans pointage passe « Absent ».
 * Appelé à l'ouverture des écrans du pointage : pas de tâche planifiée requise.
 */
export async function ensureSessions(schoolId: string, now = new Date()): Promise<void> {
  const school = await loadTimesheetSchool(schoolId);
  if (!school?.enabled || !school.startDate) return;
  const today = startOfDayUtc(now);
  const start = startOfDayUtc(school.startDate);
  if (start > today) return;

  const firstMissing = school.generatedThrough ? new Date(startOfDayUtc(school.generatedThrough).getTime() + DAY) : start;
  const from = firstMissing > start ? firstMissing : start;
  const days = daysBetween(from, today);

  const [slots, year, holidays] = await Promise.all([
    plannedSlots(schoolId),
    prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true }, select: { startDate: true, endDate: true } }),
    prisma.holiday.findMany({
      where: { OR: [{ schoolId }, { schoolId: null }], date: { gte: from, lt: new Date(today.getTime() + DAY) } },
      select: { date: true },
    }),
  ]);
  const nonWorking = new Set(holidays.map((h) => dayKey(h.date)));
  const inYear = (d: Date) => !year || (d >= startOfDayUtc(year.startDate) && d <= year.endDate);

  // Aujourd'hui : les séances pas encore commencées suivent l'emploi du temps.
  // Écritures du système (aucun utilisateur ne les demande) : basePrisma, comme lib/session.ts.
  await basePrisma.teachingSession.deleteMany({
    where: { schoolId, date: today, status: "PENDING", startsAt: { gt: new Date(now.getTime() + FROZEN_BEFORE_START) } },
  });
  // Les séances déjà là (commencées, pointées, corrigées) restent : skipDuplicates.
  const planned = days.filter(inYear).flatMap((d) => plannedSessions(slots, d, nonWorking));
  if (planned.length > 0) {
    await basePrisma.teachingSession.createMany({ data: planned.map((p) => ({ schoolId, ...p })), skipDuplicates: true });
  }
  const yesterday = new Date(today.getTime() - DAY);
  if (!school.generatedThrough || yesterday > school.generatedThrough) {
    await basePrisma.school.update({ where: { id: schoolId }, data: { timesheetGeneratedThrough: yesterday } });
  }
  await basePrisma.teachingSession.updateMany({
    where: { schoolId, status: "PENDING", endsAt: { lte: now } },
    data: { status: "ABSENT" },
  });
}

/** Un message pour l'enseignant (statut modifié, paie validée), dans la même transaction que la cause. */
export async function notifyTeacher(
  db: Db,
  entry: { schoolId: string; teacherId: string; title: string; body: string; href?: string },
) {
  await db.teacherNotification.create({ data: { ...entry, href: entry.href ?? "/enseignant/pointage" } });
}

/** Le mois est-il validé (paie verrouillée) ? */
export async function lockedMonth(schoolId: string, month: Date) {
  return prisma.timesheetMonth.findUnique({
    where: { schoolId_month: { schoolId, month } },
    select: { lockedAt: true, lockedByName: true, snapshot: true },
  });
}

export interface PayLine extends TeacherPay {
  name: string;
  subjects: string[];
}

const PAY_SESSION_SELECT = {
  teacherId: true,
  replacementTeacherId: true,
  status: true,
  startsAt: true,
  endsAt: true,
  lateMinutes: true,
  subjectName: true,
} as const;

/**
 * La paie du mois, enseignant par enseignant : figée si le mois est validé,
 * sinon calculée en direct. Seuls les enseignants qui ont des séances, des
 * remplacements ou des déductions ce mois-là apparaissent.
 */
export async function monthPayroll(schoolId: string, key: string, now = new Date(), onlyTeacherId?: string) {
  const range = monthRange(key);
  if (!range) throw new UserError("Mois illisible.");
  const school = await loadTimesheetSchool(schoolId);
  const lock = await lockedMonth(schoolId, range.start);
  const [sessions, adjustments, teachers] = await Promise.all([
    prisma.teachingSession.findMany({
      where: {
        schoolId,
        date: { gte: range.start, lt: range.end },
        ...(onlyTeacherId ? { OR: [{ teacherId: onlyTeacherId }, { replacementTeacherId: onlyTeacherId }] } : {}),
      },
      select: PAY_SESSION_SELECT,
    }),
    prisma.teacherPayAdjustment.findMany({
      where: { schoolId, month: range.start, ...(onlyTeacherId ? { teacherId: onlyTeacherId } : {}) },
      orderBy: { createdAt: "asc" },
      select: { id: true, teacherId: true, kind: true, amount: true, reason: true, createdByName: true, createdAt: true },
    }),
    prisma.teacher.findMany({
      where: { schoolId, ...(onlyTeacherId ? { id: onlyTeacherId } : {}) },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, hourlyRate: true, subjectSpecialty: true },
    }),
  ]);
  const ids = new Set([
    ...sessions.map((s) => s.teacherId),
    ...sessions.flatMap((s) => (s.status === "REPLACED" && s.replacementTeacherId ? [s.replacementTeacherId] : [])),
    ...adjustments.map((a) => a.teacherId),
  ]);
  const frozen = lock?.lockedAt && Array.isArray(lock.snapshot) ? (lock.snapshot as unknown as PayLine[]) : null;
  const lines: PayLine[] = frozen
    ? frozen.filter((l) => !onlyTeacherId || l.teacherId === onlyTeacherId)
    : teachers
        .filter((t) => ids.has(t.id))
        .map((t) => {
          const own = sessions.filter((s) => s.teacherId === t.id || s.replacementTeacherId === t.id);
          const subjects = [...new Set(sessions.filter((s) => s.teacherId === t.id).map((s) => s.subjectName))];
          return {
            ...computeTeacherPay(
              t.id,
              t.hourlyRate,
              own,
              adjustments.filter((a) => a.teacherId === t.id),
              school?.lateDeduction ?? "PRORATA",
              now,
            ),
            name: `${t.firstName} ${t.lastName}`.trim(),
            subjects: subjects.length > 0 ? subjects : t.subjectSpecialty ? [t.subjectSpecialty] : [],
          };
        });
  const totals = lines.reduce(
    (acc, l) => ({
      minutes: acc.minutes + l.minutes,
      honoraires: acc.honoraires + l.honoraires,
      deductions: acc.deductions + l.deductions,
      net: acc.net + l.net,
    }),
    { minutes: 0, honoraires: 0, deductions: 0, net: 0 },
  );
  return {
    range,
    lines,
    totals,
    adjustments,
    teachers,
    locked: lock?.lockedAt ? { at: lock.lockedAt, by: lock.lockedByName } : null,
    lateDeduction: school?.lateDeduction ?? "PRORATA",
  };
}
