import { requireFeature } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { FEATURES } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "@/lib/i18n/server";
import {
  isInMonth,
  isPresent,
  lastMonthKeys,
  monthlyAttendance,
  monthlySums,
  percentChange,
  runningTotals,
  type MonthKey,
} from "@/lib/dashboard-data";
import {
  levelDistribution,
  monthlyCounts,
  pointsChange,
  referenceDate,
  subjectAverages,
} from "@/lib/stats-data";
import { StatisticsView, type StatsData } from "./statistics-view";

/** « sept. » devient « Sept » : libellés d'axe courts. */
function shortLabel(value: string) {
  const trimmed = value.replace(/\.$/, "");
  return trimmed.charAt(0).toLocaleUpperCase() + trimmed.slice(1);
}

const sameMonth = (a: MonthKey, b: MonthKey) => a.year === b.year && a.month === b.month;

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string }>;
}) {
  const user = await requireFeature(FEATURES.ADVANCED_STATS, ROLES.DIRECTOR);
  const schoolId = user.schoolId;
  const { annee } = await searchParams;
  const { locale } = await getTranslations();
  const now = new Date();

  const years = await prisma.academicYear.findMany({
    where: { schoolId },
    orderBy: { startDate: "desc" },
    select: { id: true, label: true, isCurrent: true, endDate: true },
  });
  const year = years.find((y) => y.id === annee) ?? years.find((y) => y.isCurrent) ?? years[0] ?? null;
  const isCurrent = year?.isCurrent ?? true;

  // Douze mois jusqu'au mois de référence : aujourd'hui pour l'année en
  // cours, la fin de l'année pour une année terminée.
  const reference = year ? referenceDate(year.endDate, now) : now;
  const months = lastMonthKeys(reference, 12);
  const trendMonths = months.slice(-6);
  const from = new Date(Date.UTC(months[0].year, months[0].month, 1));
  const to = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1));

  const classes = year
    ? await prisma.classRoom.findMany({
        where: { schoolId, academicYearId: year.id },
        select: {
          id: true,
          level: true,
          // Même règle que les autres écrans pour l'année en cours : seuls les
          // élèves actifs comptent. Une année passée garde tous ses élèves.
          _count: { select: { students: { where: isCurrent ? { status: "ACTIVE" } : {} } } },
        },
      })
    : [];
  const classIds = classes.map((c) => c.id);

  const [students, attendance, payments, grades] = await Promise.all([
    prisma.student.findMany({
      where: isCurrent ? { schoolId, status: "ACTIVE" } : { schoolId, classId: { in: classIds } },
      select: { gender: true, createdAt: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { schoolId, classId: { in: classIds }, date: { gte: from, lt: to } },
      select: { date: true, status: true },
    }),
    prisma.payment.findMany({
      where: { schoolId, paidAt: { gte: from, lt: to } },
      select: { paidAt: true, amount: true },
    }),
    year
      ? prisma.grade.findMany({
          where: {
            exam: { schoolId, academicYearId: year.id },
            isAbsent: false,
            score: { not: null },
          },
          select: {
            score: true,
            createdAt: true,
            exam: { select: { maxScore: true, subject: { select: { name: true } } } },
          },
        })
      : Promise.resolve([]),
  ]);

  const monthFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : locale, {
    month: "short",
    timeZone: "UTC",
  });
  const label = (key: MonthKey) =>
    shortLabel(monthFormatter.format(new Date(Date.UTC(key.year, key.month, 1))));

  // — Graphiques mensuels. Un mois sans appel est omis, pas compté à zéro.
  const attendanceRates = monthlyAttendance(attendance, months);
  const revenue = monthlySums(payments.map((p) => ({ at: p.paidAt, amount: p.amount })), months);
  const trendRates = monthlyAttendance(attendance, trendMonths);
  const present = attendance.filter((a) => isPresent(a.status)).length;
  const last = months.length - 1;

  const averages = subjectAverages(
    grades.flatMap((g) =>
      g.score == null ? [] : [{ score: g.score, maxScore: g.exam.maxScore, subject: g.exam.subject.name }],
    ),
  );
  const levels = levelDistribution(classes.map((c) => ({ level: c.level, count: c._count.students })));

  const boys = students.filter((s) => s.gender === "M").length;
  const girls = students.filter((s) => s.gender === "F").length;

  const data: StatsData = {
    years: years.map((y) => ({ id: y.id, label: y.label })),
    yearId: year?.id ?? null,

    totalStudents: students.length,
    newThisMonth: students.filter((s) => isInMonth(s.createdAt, months[last])).length,
    studentTrend: runningTotals(students.map((s) => s.createdAt), trendMonths),

    overallAttendance: attendance.length === 0 ? null : Math.round((present / attendance.length) * 100),
    attendanceChange: pointsChange(trendRates),
    attendanceTrend: trendRates.map((r) => r.rate),

    totalRevenue: revenue.reduce((sum, v) => sum + v, 0),
    revenueChange: percentChange(revenue[last] ?? 0, revenue[last - 1] ?? 0),
    revenueTrend: revenue.slice(-6),

    subjectCount: averages.length,
    gradeCount: grades.length,
    gradesTrend: monthlyCounts(grades.map((g) => g.createdAt), trendMonths),

    attendanceByMonth: attendanceRates.map(({ month, rate }) => ({
      label: label(month),
      value: rate,
      index: months.findIndex((m) => sameMonth(m, month)),
    })),
    revenueByMonth: months.map((m, i) => ({ label: label(m), value: revenue[i], index: i })),
    subjectAverages: averages,
    levelDistribution: levels,
    studentsInAClass: levels.reduce((sum, d) => sum + d.value, 0),
    gender: { boys, girls, unknown: students.length - boys - girls },
    table: months.map((m, i) => ({
      label: label(m),
      attendance: attendanceRates.find((r) => sameMonth(r.month, m))?.rate ?? null,
      revenue: revenue[i],
    })),
  };

  return <StatisticsView data={data} />;
}
