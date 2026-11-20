import { Clock, Wallet, Timer } from "lucide-react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { formatMRU } from "@/lib/format";
import { StatTile } from "@/components/ui/stat-tile";
import { SessionStatusBadge } from "@/components/timesheet/status-badge";
import { MonthSelect } from "@/components/timesheet/month-select";
import { MarkNotificationsRead } from "@/components/timesheet/mark-notifications-read";
import { ensureSessions, loadTimesheetSchool, monthPayroll, teacherOfUser } from "@/lib/timesheet-data";
import { dmy, effectiveStatus, hm, hoursLabel, monthKeyOf, monthRange, timesheetMonths } from "@/lib/timesheet";

/**
 * L'espace pointage de l'enseignant : ses séances du mois, ses heures, son
 * net estimé (ou validé par la direction), et les messages de la direction.
 */
export default async function MyTimesheetPage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const user = await requireRole(ROLES.TEACHER);
  const [school, teacher] = await Promise.all([loadTimesheetSchool(user.schoolId), teacherOfUser(user.id, user.schoolId)]);
  if (!school?.enabled || !teacher) {
    return (
      <p className="rounded-xl border border-border bg-surface px-5 py-16 text-center text-sm text-foreground/60">
        {!teacher ? "Votre compte n'est relié à aucune fiche enseignant." : "Le pointage n'est pas activé pour votre école."}
      </p>
    );
  }
  const now = new Date();
  await ensureSessions(user.schoolId, now);
  const months = timesheetMonths(school.startDate, now);
  const { mois } = await searchParams;
  const key = mois && months.includes(mois) ? mois : monthKeyOf(now);
  const range = monthRange(key)!;

  const [payroll, sessions, notifications] = await Promise.all([
    monthPayroll(user.schoolId, key, now, teacher.id),
    prisma.teachingSession.findMany({
      where: {
        schoolId: user.schoolId,
        date: { gte: range.start, lt: range.end },
        OR: [{ teacherId: teacher.id }, { replacementTeacherId: teacher.id, status: "REPLACED" }],
      },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        teacherId: true,
        startsAt: true,
        endsAt: true,
        className: true,
        subjectName: true,
        status: true,
        lateMinutes: true,
        observation: true,
        teacher: { select: { firstName: true, lastName: true } },
        replacementTeacher: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.teacherNotification.findMany({
      where: { schoolId: user.schoolId, teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, title: true, body: true, readAt: true, createdAt: true },
    }),
  ]);
  const line = payroll.lines.find((l) => l.teacherId === teacher.id);
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Mon pointage</h1>
          <p className="mt-1 text-sm text-foreground/60">Vos séances, vos heures et votre paie du mois.</p>
        </div>
        <MonthSelect months={months} value={key} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Heures du mois" value={hoursLabel(line?.minutes ?? 0)} icon={Clock} tone="primary" />
        <StatTile
          label="Taux horaire"
          value={teacher.hourlyRate != null ? formatMRU(teacher.hourlyRate) : "Non renseigné"}
          icon={Timer}
          tone="primary"
        />
        <StatTile
          label={payroll.locked ? "Net à payer (validé)" : "Net estimé à ce jour"}
          value={formatMRU(line?.net ?? 0)}
          icon={Wallet}
          tone="accent"
        />
      </div>

      {line && (line.deductions > 0 || line.honoraires > 0) && (
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground/70" data-testid="my-pay-detail">
          Honoraires {formatMRU(line.honoraires)}
          {line.lateDeduction > 0 && <> · retards −{formatMRU(line.lateDeduction)}</>}
          {line.advances > 0 && <> · avances −{formatMRU(line.advances)}</>}
          {line.otherDeductions > 0 && <> · autres déductions −{formatMRU(line.otherDeductions)}</>}
          {" "}= <strong className="text-foreground">{formatMRU(line.net)}</strong>
        </p>
      )}

      {notifications.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-soft" data-testid="teacher-notifications">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Messages de la direction</h2>
          <ul className="divide-y divide-border">
            {notifications.map((n) => (
              <li key={n.id} className="py-2.5 text-sm" data-unread={!n.readAt || undefined}>
                <p className="font-medium text-foreground">
                  {!n.readAt && <span className="me-1.5 inline-block h-2 w-2 rounded-full bg-red-500" aria-label="Nouveau" />}
                  {n.title}
                </p>
                <p className="text-foreground/70">{n.body}</p>
                <p className="text-xs text-foreground/50">
                  {dmy(n.createdAt)} à {hm(n.createdAt)}
                </p>
              </li>
            ))}
          </ul>
          {unread > 0 && <MarkNotificationsRead />}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-surface shadow-soft">
        <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Séances du mois</h2>
        {sessions.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-foreground/60">Aucune séance ce mois-ci.</p>
        ) : (
          <ul className="divide-y divide-border" data-testid="my-sessions">
            {sessions.map((s) => {
              const replacing = s.teacherId !== teacher.id;
              const status = effectiveStatus(s, now);
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium tabular-nums text-foreground">
                      {dmy(s.startsAt)} · {hm(s.startsAt)}–{hm(s.endsAt)}
                    </p>
                    <p className="text-foreground/70">
                      {s.className} · {s.subjectName}
                      {replacing && ` · remplacement de ${s.teacher.firstName} ${s.teacher.lastName}`}
                    </p>
                    {s.observation && <p className="text-xs text-foreground/60">{s.observation}</p>}
                  </div>
                  {replacing ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      Remplacement fait
                    </span>
                  ) : (
                    <SessionStatusBadge
                      status={status}
                      lateMinutes={s.lateMinutes}
                      replacement={s.replacementTeacher ? `${s.replacementTeacher.firstName} ${s.replacementTeacher.lastName}` : null}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
