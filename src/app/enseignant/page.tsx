import Link from "next/link";
import { ClipboardCheck, GraduationCap, CalendarDays, Users } from "lucide-react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { getTeacherScope } from "@/lib/teacher-scope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { formatDate } from "@/lib/format";

const DAY_LABELS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export default async function TeacherHome() {
  const user = await requireRole(ROLES.TEACHER);
  const scope = await getTeacherScope(user.id, user.schoolId);

  if (!scope) {
    return (
      <div className="rounded-xl border border-border bg-surface px-5 py-16 text-center">
        <p className="text-sm text-foreground/60">
          Votre compte n&apos;est pas encore rattaché à une fiche enseignant.
          Demandez à la direction de faire le lien.
        </p>
      </div>
    );
  }

  const jsDay = new Date().getDay(); // 0 = dimanche
  const todayDow = jsDay >= 1 && jsDay <= 5 ? jsDay : null;

  const [classes, studentCount, upcomingExams, todaySlots] = await Promise.all([
    prisma.classRoom.findMany({
      where: { id: { in: scope.classIds } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        level: true,
        // Même filtre que le KPI « Mes élèves » ci-dessous : sans lui, le
        // détail par classe comptait aussi les élèves inactifs, transférés ou
        // diplômés, et le total des classes dépassait le compteur du haut.
        _count: { select: { students: { where: { status: "ACTIVE" } } } },
      },
    }),
    prisma.student.count({
      where: { classId: { in: scope.classIds }, status: "ACTIVE" },
    }),
    prisma.exam.findMany({
      where: { classId: { in: scope.classIds }, date: { gte: new Date() } },
      orderBy: { date: "asc" },
      take: 5,
      include: {
        subject: { select: { name: true } },
        classRoom: { select: { name: true } },
      },
    }),
    todayDow
      ? prisma.scheduleSlot.findMany({
          where: { classId: { in: scope.classIds }, dayOfWeek: todayDow },
          orderBy: { startMinutes: "asc" },
          include: {
            classRoom: { select: { name: true } },
            classSubject: { include: { subject: { select: { name: true } } } },
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Bonjour {scope.teacher.firstName}
        </h1>
        <p className="mt-1 text-sm text-foreground/60">
          Voici vos classes et votre journée.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Mes classes" value={String(classes.length)} icon={Users} tone="primary" />
        <StatTile label="Mes élèves" value={String(studentCount)} icon={Users} tone="primary" />
        <StatTile
          label="Cours aujourd'hui"
          value={String(todaySlots.length)}
          icon={CalendarDays}
          tone="accent"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/enseignant/presences"
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm transition-colors hover:bg-surface-muted"
        >
          <ClipboardCheck className="h-5 w-5 text-primary-700" />
          <span className="text-sm font-medium text-foreground">Faire l&apos;appel</span>
        </Link>
        <Link
          href="/enseignant/notes"
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm transition-colors hover:bg-surface-muted"
        >
          <GraduationCap className="h-5 w-5 text-primary-700" />
          <span className="text-sm font-medium text-foreground">Saisir les notes</span>
        </Link>
        <Link
          href="/enseignant/emploi-du-temps"
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm transition-colors hover:bg-surface-muted"
        >
          <CalendarDays className="h-5 w-5 text-primary-700" />
          <span className="text-sm font-medium text-foreground">Mon emploi du temps</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Aujourd&apos;hui{todayDow ? ` — ${DAY_LABELS[todayDow]}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {todaySlots.length === 0 ? (
              <p className="py-6 text-center text-xs text-foreground/40">
                Aucun cours prévu aujourd&apos;hui.
              </p>
            ) : (
              <ul className="space-y-2">
                {todaySlots.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2"
                  >
                    <span className="text-sm text-foreground">
                      {s.classSubject.subject.name}
                      <span className="ml-2 text-xs text-foreground/50">
                        {s.classRoom.name}
                      </span>
                    </span>
                    <span className="text-xs font-medium text-primary-800">
                      {minutesToTime(s.startMinutes)} – {minutesToTime(s.endMinutes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Prochains examens</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {upcomingExams.length === 0 ? (
              <p className="py-6 text-center text-xs text-foreground/40">
                Aucun examen à venir.
              </p>
            ) : (
              <ul className="space-y-2">
                {upcomingExams.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2"
                  >
                    <span className="text-sm text-foreground">
                      {e.subject.name}
                      <span className="ml-2 text-xs text-foreground/50">
                        {e.classRoom.name}
                      </span>
                    </span>
                    <span className="text-xs text-foreground/60">{formatDate(e.date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Mes classes</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {classes.length === 0 ? (
            <p className="py-6 text-center text-xs text-foreground/40">
              Aucune classe ne vous est assignée pour le moment.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => (
                <span
                  key={c.id}
                  className="rounded-lg bg-primary-50 px-3 py-1.5 text-sm text-primary-800"
                >
                  {c.name}
                  <span className="ml-1.5 text-xs text-primary-700/70">
                    {c._count.students} élève(s)
                  </span>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
