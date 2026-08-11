import Link from "next/link";
import { requireRole } from "@/lib/session";
import { ROLES, ROLE_LABELS } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, DonutChart, type Point } from "@/components/charts/chart-primitives";
import { formatMRU, formatLongDate, formatEventTime } from "@/lib/format";
import { getTranslations } from "@/lib/i18n/server";
import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CircleCheck,
  ClipboardCheck,
  Contact,
  GraduationCap,
  Hourglass,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

/**
 * Les N derniers mois, du plus ancien au plus récent (année scolaire).
 * Le nom du mois vient d'Intl : il suit donc la langue choisie, y compris en
 * arabe, sans table de correspondance à maintenir.
 */
function lastMonths(count: number, locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, { month: "short" });
  const months: { label: string; year: number; month: number }[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: formatter.format(d),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return months;
}

interface ActivityItem {
  at: Date;
  title: string;
  detail: string;
  icon: typeof Users;
  tone: string;
}

export default async function DashboardPage() {
  const user = await requireRole(ROLES.DIRECTOR);
  const schoolId = user.schoolId;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const inSevenDays = new Date(startOfToday);
  inSevenDays.setDate(inSevenDays.getDate() + 7);

  const { t, locale } = await getTranslations();
  const months = lastMonths(9, locale);

  function attendanceQuality(rate: number, hasData: boolean) {
    if (!hasData) return t("dashboard.noRollCall");
    if (rate >= 90) return t("dashboard.veryGood");
    if (rate >= 75) return t("dashboard.correct");
    return t("dashboard.toWatch");
  }
  const since = new Date(months[0].year, months[0].month, 1);

  const [
    studentCount,
    newStudents,
    teacherCount,
    newTeachers,
    parentCount,
    todayAttendance,
    monthPayments,
    unpaidFees,
    upcomingExams,
    classes,
    attendanceHistory,
    recentStudents,
    recentPayments,
    recentExams,
    recentAttendance,
    grades,
    students,
  ] = await Promise.all([
    prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
    prisma.student.count({ where: { schoolId, createdAt: { gte: startOfMonth } } }),
    prisma.teacher.count({ where: { schoolId, status: "ACTIVE" } }),
    prisma.teacher.count({ where: { schoolId, createdAt: { gte: startOfMonth } } }),
    prisma.parent.count({ where: { schoolId } }),
    prisma.attendanceRecord.findMany({
      where: { schoolId, date: { gte: startOfToday, lt: endOfToday } },
      select: { status: true },
    }),
    prisma.payment.aggregate({
      where: { schoolId, paidAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.fee.aggregate({
      where: { schoolId, status: { not: "PAID" } },
      _sum: { amount: true },
    }),
    prisma.exam.count({
      where: { schoolId, date: { gte: startOfToday, lt: inSevenDays } },
    }),
    prisma.classRoom.findMany({
      where: { schoolId },
      select: { name: true, level: true, _count: { select: { students: true } } },
    }),
    prisma.attendanceRecord.findMany({
      where: { schoolId, date: { gte: since } },
      select: { date: true, status: true },
    }),
    prisma.student.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        firstName: true,
        lastName: true,
        createdAt: true,
        classRoom: { select: { name: true } },
      },
    }),
    prisma.payment.findMany({
      where: { schoolId },
      orderBy: { paidAt: "desc" },
      take: 3,
      select: {
        amount: true,
        paidAt: true,
        student: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.exam.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 2,
      select: {
        title: true,
        createdAt: true,
        subject: { select: { name: true } },
        classRoom: { select: { name: true } },
      },
    }),
    prisma.attendanceRecord.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        status: true,
        date: true,
        createdAt: true,
        classRoom: { select: { name: true } },
      },
    }),
    prisma.grade.findMany({
      where: { exam: { schoolId }, isAbsent: false, score: { not: null } },
      select: { studentId: true, score: true, exam: { select: { maxScore: true } } },
    }),
    prisma.student.findMany({
      where: { schoolId, status: "ACTIVE" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        classRoom: { select: { name: true } },
      },
    }),
  ]);

  // — Présence du jour
  const presentToday = todayAttendance.filter(
    (a) => a.status === "PRESENT" || a.status === "LATE",
  ).length;
  const attendanceRate =
    todayAttendance.length === 0
      ? 0
      : Math.round((presentToday / todayAttendance.length) * 100);

  // — Évolution de la présence : les mois sans appel sont omis, pas mis à zéro.
  const attendanceByMonth: Point[] = months
    .map((m) => {
      const records = attendanceHistory.filter(
        (a) => a.date.getFullYear() === m.year && a.date.getMonth() === m.month,
      );
      const present = records.filter(
        (a) => a.status === "PRESENT" || a.status === "LATE",
      ).length;
      return {
        label: m.label,
        value: records.length === 0 ? 0 : Math.round((present / records.length) * 100),
        count: records.length,
      };
    })
    .filter((m) => m.count > 0)
    .map(({ label, value }) => ({ label, value }));

  // — Répartition des élèves par niveau
  const byLevel = new Map<string, number>();
  for (const c of classes) {
    byLevel.set(c.level, (byLevel.get(c.level) ?? 0) + c._count.students);
  }
  const levelDistribution: Point[] = [...byLevel.entries()]
    .map(([label, value]) => ({ label, value }))
    .filter((d) => d.value > 0);
  const activeClasses = classes.filter((c) => c._count.students > 0).length;

  // — Meilleures moyennes : notes ramenées sur 20, tous examens confondus.
  const perStudent = new Map<string, { total: number; count: number }>();
  for (const g of grades) {
    if (g.score == null) continue;
    const entry = perStudent.get(g.studentId) ?? { total: 0, count: 0 };
    entry.total += (g.score / (g.exam.maxScore || 20)) * 20;
    entry.count += 1;
    perStudent.set(g.studentId, entry);
  }
  const topStudents = students
    .flatMap((s) => {
      const entry = perStudent.get(s.id);
      if (!entry || entry.count === 0) return [];
      return [
        {
          id: s.id,
          name: `${s.firstName} ${s.lastName}`,
          className: s.classRoom?.name ?? t("students.noClass"),
          average: entry.total / entry.count,
        },
      ];
    })
    .sort((a, b) => b.average - a.average)
    .slice(0, 5);

  // — Activité récente : élèves, paiements, appels et examens, fusionnés.
  const attendanceBatches = new Map<
    string,
    { className: string; present: number; total: number; at: Date }
  >();
  for (const record of recentAttendance) {
    const key = `${record.classRoom.name}-${record.date.toDateString()}`;
    const entry =
      attendanceBatches.get(key) ??
      { className: record.classRoom.name, present: 0, total: 0, at: record.createdAt };
    entry.total += 1;
    if (record.status === "PRESENT" || record.status === "LATE") entry.present += 1;
    if (record.createdAt > entry.at) entry.at = record.createdAt;
    attendanceBatches.set(key, entry);
  }

  const activity: ActivityItem[] = [
    ...recentStudents.map((s) => ({
      at: s.createdAt,
      title: t("activity.newStudent"),
      detail: `${s.firstName} ${s.lastName}${s.classRoom ? ` — ${s.classRoom.name}` : ""}`,
      icon: UserPlus,
      tone: "bg-primary-50 text-primary-600",
    })),
    ...recentPayments.map((p) => ({
      at: p.paidAt,
      title: t("activity.paymentReceived"),
      detail: `${formatMRU(p.amount)} — ${p.student.firstName} ${p.student.lastName}`,
      icon: Wallet,
      tone: "bg-accent-50 text-accent-600",
    })),
    ...[...attendanceBatches.values()].slice(0, 3).map((b) => ({
      at: b.at,
      title: t("activity.attendanceRecorded"),
      detail: `${b.className} — ${Math.round((b.present / b.total) * 100)}%`,
      icon: ClipboardCheck,
      tone: "bg-sky-50 text-sky-600",
    })),
    ...recentExams.map((e) => ({
      at: e.createdAt,
      title: t("activity.examCreated"),
      detail: `${e.subject.name} — ${e.title} (${e.classRoom.name})`,
      icon: GraduationCap,
      tone: "bg-violet-50 text-violet-600",
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 6);

  const firstName = (user.name ?? "").split(" ")[0] || ROLE_LABELS.DIRECTOR;

  return (
    <div className="space-y-6">
      <div className="animate-page-in flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("dashboard.hello")}, {firstName} <span className="inline-block animate-wave" aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-sm text-foreground/55">{t("dashboard.title")}</p>
        </div>
        <span className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground/70 shadow-sm">
          {t("dashboard.today")}, {formatLongDate(now)}
          <CalendarDays className="h-4 w-4 text-foreground/40" />
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={t("dashboard.totalStudents")}
          value={String(studentCount)}
          icon={Users}
          tone="primary"
          hint={
            newStudents > 0
              ? `+${newStudents} ${t("dashboard.thisMonthShort")}`
              : t("dashboard.noEnrollmentThisMonth")
          }
          hintPositive={newStudents > 0}
          href="/directeur/eleves"
          delay={0}
        />
        <StatTile
          label={t("nav.teachers")}
          value={String(teacherCount)}
          icon={Contact}
          tone="primary"
          hint={
            newTeachers > 0
              ? `+${newTeachers} ${t("dashboard.thisMonthShort")}`
              : t("dashboard.stableTeam")
          }
          hintPositive={newTeachers > 0}
          href="/directeur/enseignants"
          delay={40}
        />
        <StatTile
          label={t("dashboard.attendanceOfDay")}
          value={`${attendanceRate}%`}
          icon={CircleCheck}
          tone="primary"
          hint={attendanceQuality(attendanceRate, todayAttendance.length > 0)}
          href="/directeur/presences"
          delay={80}
        />
        <StatTile
          label={t("dashboard.moneyCollected")}
          value={formatMRU(monthPayments._sum.amount ?? 0)}
          icon={Wallet}
          tone="accent"
          hint={t("dashboard.thisMonth")}
          href="/directeur/finance"
          delay={120}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={t("dashboard.unpaid")}
          value={formatMRU(unpaidFees._sum.amount ?? 0)}
          icon={Hourglass}
          tone="warning"
          hint={t("dashboard.unpaidHint")}
          href="/directeur/finance"
          delay={160}
        />
        <StatTile
          label={t("dashboard.upcomingExams")}
          value={String(upcomingExams)}
          icon={CalendarCheck}
          tone="neutral"
          hint={t("dashboard.thisWeek")}
          href="/directeur/examens"
          delay={200}
        />
        <StatTile
          label={t("dashboard.activeClasses")}
          value={String(activeClasses)}
          icon={BookOpen}
          tone="neutral"
          hint={`${t("dashboard.outOf")} ${classes.length}`}
          href="/directeur/classes"
          delay={240}
        />
        <StatTile
          label={t("nav.parents")}
          value={String(parentCount)}
          icon={Users}
          tone="primary"
          hint={t("dashboard.contacts")}
          href="/directeur/parents"
          delay={280}
        />
      </div>

      <div className="animate-page-in grid grid-cols-1 gap-4 xl:grid-cols-3" style={{ animationDelay: "260ms" }}>
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("dashboard.attendanceTrend")}</CardTitle>
            <Link
              href="/directeur/statistiques"
              className="text-xs font-medium text-primary-600 hover:underline"
            >
              {t("dashboard.viewStatistics")}
            </Link>
          </CardHeader>
          <CardContent>
            <LineChart data={attendanceByMonth} unit="%" maxOverride={100} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {activity.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-foreground/50">
                {t("dashboard.nothingToReport")}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {activity.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <li key={i} className="flex items-start gap-3 px-5 py-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.tone}`}
                      >
                        <Icon className="h-4.5 w-4.5" strokeWidth={2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {item.title}
                        </p>
                        <p className="truncate text-xs text-foreground/55">
                          {item.detail}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-foreground/40">
                        {formatEventTime(item.at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="animate-page-in grid grid-cols-1 gap-4 xl:grid-cols-2" style={{ animationDelay: "320ms" }}>
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.distributionByClass")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={levelDistribution} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("dashboard.topAverages")}</CardTitle>
            <Link
              href="/directeur/bulletins"
              className="text-xs font-medium text-primary-600 hover:underline"
            >
              {t("dashboard.viewReportCards")}
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {topStudents.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-foreground/50">
                {t("dashboard.noGradesYet")}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-foreground/50">
                    <th className="px-5 py-2.5 text-left font-medium">#</th>
                    <th className="px-2 py-2.5 text-left font-medium">
                      {t("finance.student")}
                    </th>
                    <th className="px-2 py-2.5 text-left font-medium">
                      {t("students.class")}
                    </th>
                    <th className="px-5 py-2.5 text-right font-medium">
                      {t("dashboard.average")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {topStudents.map((s, i) => (
                    <tr key={s.id}>
                      <td className="px-5 py-3 text-foreground/40">{i + 1}</td>
                      <td className="px-2 py-3 font-medium text-foreground">
                        {s.name}
                      </td>
                      <td className="px-2 py-3 text-foreground/60">{s.className}</td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className="inline-block rounded-lg bg-primary-50 px-2.5 py-1 text-sm font-semibold text-primary-700"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {s.average.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
