import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { StatisticsView, type StatsData } from "./statistics-view";

const MONTH_LABELS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];

/** Les 6 derniers mois, du plus ancien au plus récent. */
function lastSixMonths() {
  const months: { key: string; label: string; year: number; month: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: MONTH_LABELS[d.getMonth()],
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return months;
}

export default async function StatisticsPage() {
  const user = await requireRole(ROLES.DIRECTOR);
  const months = lastSixMonths();
  const since = new Date(months[0].year, months[0].month, 1);

  const [students, attendance, payments, grades, classes] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId: user.schoolId, status: "ACTIVE" },
      select: { gender: true, classRoom: { select: { level: true } } },
    }),
    prisma.attendanceRecord.findMany({
      where: { schoolId: user.schoolId, date: { gte: since } },
      select: { date: true, status: true },
    }),
    prisma.payment.findMany({
      where: { schoolId: user.schoolId, paidAt: { gte: since } },
      select: { paidAt: true, amount: true },
    }),
    prisma.grade.findMany({
      where: {
        exam: { schoolId: user.schoolId },
        isAbsent: false,
        score: { not: null },
      },
      select: {
        score: true,
        exam: { select: { maxScore: true, subject: { select: { name: true } } } },
      },
    }),
    prisma.classRoom.findMany({
      where: { schoolId: user.schoolId },
      select: { level: true, _count: { select: { students: true } } },
    }),
  ]);

  // — Présence : % de présents par mois
  const attendanceByMonth = months.map((m) => {
    const records = attendance.filter(
      (a) => a.date.getFullYear() === m.year && a.date.getMonth() === m.month,
    );
    const present = records.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
    return {
      label: m.label,
      value: records.length === 0 ? 0 : Math.round((present / records.length) * 100),
    };
  });

  // — Revenus encaissés par mois
  const revenueByMonth = months.map((m) => ({
    label: m.label,
    value: payments
      .filter((p) => p.paidAt.getFullYear() === m.year && p.paidAt.getMonth() === m.month)
      .reduce((sum, p) => sum + p.amount, 0),
  }));

  // — Moyenne par matière, ramenée sur 20
  const bySubject = new Map<string, { total: number; count: number }>();
  for (const g of grades) {
    if (g.score == null) continue;
    const name = g.exam.subject.name;
    const scaled = (g.score / (g.exam.maxScore || 20)) * 20;
    const entry = bySubject.get(name) ?? { total: 0, count: 0 };
    entry.total += scaled;
    entry.count += 1;
    bySubject.set(name, entry);
  }
  const subjectAverages = [...bySubject.entries()]
    .map(([label, { total, count }]) => ({
      label,
      value: Math.round((total / count) * 10) / 10,
    }))
    .sort((a, b) => b.value - a.value);

  // — Répartition par niveau
  const byLevel = new Map<string, number>();
  for (const c of classes) {
    byLevel.set(c.level, (byLevel.get(c.level) ?? 0) + c._count.students);
  }
  const levelDistribution = [...byLevel.entries()]
    .map(([label, value]) => ({ label, value }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  // — Répartition par genre
  const boys = students.filter((s) => s.gender === "M").length;
  const girls = students.filter((s) => s.gender === "F").length;
  const unknown = students.length - boys - girls;

  const totalRevenue = revenueByMonth.reduce((sum, m) => sum + m.value, 0);
  const overallAttendance =
    attendance.length === 0
      ? 0
      : Math.round(
          (attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length /
            attendance.length) *
            100,
        );

  const data: StatsData = {
    totalStudents: students.length,
    overallAttendance,
    totalRevenue,
    subjectCount: subjectAverages.length,
    attendanceByMonth,
    revenueByMonth,
    subjectAverages,
    levelDistribution,
    gender: { boys, girls, unknown },
  };

  return <StatisticsView data={data} />;
}
