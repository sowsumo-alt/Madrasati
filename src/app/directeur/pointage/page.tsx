import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { ensureSessions, loadTimesheetSchool } from "@/lib/timesheet-data";
import { dayKey, effectiveStatus, startOfDayUtc } from "@/lib/timesheet";
import { TimesheetDisabled, TimesheetHeader } from "./timesheet-tabs";
import { DayBoard, type BoardSession } from "./day-board";

/**
 * Tableau du jour : toutes les séances de l'école, leur statut (vert,
 * orange, rouge) et la correction par la direction.
 */
export default async function TimesheetDayPage({ searchParams }: { searchParams: Promise<{ jour?: string }> }) {
  const user = await requireRole(ROLES.DIRECTOR);
  const school = await loadTimesheetSchool(user.schoolId);
  if (!school?.enabled) return <TimesheetDisabled />;

  const now = new Date();
  await ensureSessions(user.schoolId, now);
  const { jour } = await searchParams;
  const today = startOfDayUtc(now);
  const asked = jour && /^\d{4}-\d{2}-\d{2}$/.test(jour) ? new Date(`${jour}T00:00:00Z`) : today;
  const date = Number.isNaN(asked.getTime()) ? today : asked;

  const [sessions, teachers] = await Promise.all([
    prisma.teachingSession.findMany({
      where: { schoolId: user.schoolId, date },
      orderBy: [{ startsAt: "asc" }, { className: "asc" }],
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        className: true,
        subjectName: true,
        status: true,
        lateMinutes: true,
        checkedInAt: true,
        checkInDistance: true,
        observation: true,
        teacher: { select: { id: true, firstName: true, lastName: true, userId: true } },
        replacementTeacher: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { changes: true } },
      },
    }),
    prisma.teacher.findMany({
      where: { schoolId: user.schoolId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const rows: BoardSession[] = sessions.map((s) => ({
    id: s.id,
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
    className: s.className,
    subjectName: s.subjectName,
    status: effectiveStatus(s, now),
    lateMinutes: s.lateMinutes,
    checkedInAt: s.checkedInAt?.toISOString() ?? null,
    distance: s.checkInDistance,
    observation: s.observation,
    teacherId: s.teacher.id,
    teacherName: `${s.teacher.firstName} ${s.teacher.lastName}`.trim(),
    replacementId: s.replacementTeacher?.id ?? null,
    replacementName: s.replacementTeacher ? `${s.replacementTeacher.firstName} ${s.replacementTeacher.lastName}`.trim() : null,
    corrected: s._count.changes > 0,
  }));
  const withoutAccount = [...new Map(sessions.filter((s) => !s.teacher.userId).map((s) => [s.teacher.id, s.teacher])).values()];

  return (
    <div className="space-y-5">
      <TimesheetHeader current="jour" title="Pointage des enseignants" subtitle="Les séances du jour, en direct. Corrigez un statut, notez un remplacement." />

      {(school.latitude == null || school.longitude == null) && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="timesheet-no-position">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            La position de l&apos;école n&apos;est pas enregistrée : les enseignants ne peuvent pas encore pointer.{" "}
            <Link href="/directeur/parametres#pointage" className="font-semibold underline">
              L&apos;enregistrer dans les Paramètres
            </Link>
          </span>
        </p>
      )}
      {withoutAccount.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Sans compte, ces enseignants ne peuvent pas pointer : {withoutAccount.map((t) => `${t.firstName} ${t.lastName}`).join(", ")}.{" "}
            <Link href="/directeur/enseignants" className="font-semibold underline">
              Créer leur accès
            </Link>
          </span>
        </p>
      )}

      <DayBoard
        day={dayKey(date)}
        isToday={date.getTime() === today.getTime()}
        isFuture={date > today}
        sessions={rows}
        teachers={teachers.map((t) => ({ id: t.id, name: `${t.firstName} ${t.lastName}`.trim() }))}
        readOnly={user.readOnly}
      />
    </div>
  );
}
