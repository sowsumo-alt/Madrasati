import { requireFeature } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { FEATURES } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { RhView, type TeacherHrRow } from "./rh-view";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Jours calendaires inclusifs entre deux dates — pas de distinction week-end. */
function daysBetweenInclusive(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

export default async function HrPage() {
  const user = await requireFeature(FEATURES.HR_PAYROLL, ROLES.DIRECTOR);

  const [teachers, school, academicYear] = await Promise.all([
    prisma.teacher.findMany({
      where: { schoolId: user.schoolId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        contract: { include: { bonuses: true } },
        leaves: true,
      },
    }),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } }),
    prisma.academicYear.findFirst({ where: { schoolId: user.schoolId, isCurrent: true } }),
  ]);

  const yearStart = academicYear?.startDate ?? new Date(new Date().getFullYear(), 8, 1);
  const yearEnd = academicYear?.endDate ?? new Date(new Date().getFullYear() + 1, 5, 30);

  let totalPayroll = 0;

  const rows: TeacherHrRow[] = teachers.map((t) => {
    const baseSalary = t.monthlySalary ?? 0;
    const bonuses = t.contract?.bonuses.map((b) => ({ label: b.label, amount: b.amount })) ?? [];
    const bonusTotal = bonuses.reduce((sum, b) => sum + b.amount, 0);
    totalPayroll += baseSalary + bonusTotal;

    const leaveDaysPerYear = t.contract?.leaveDaysPerYear ?? 30;
    const leavesThisYear = t.leaves.filter(
      (l) => l.startDate >= yearStart && l.startDate <= yearEnd,
    );
    const daysUsed = leavesThisYear.reduce(
      (sum, l) => sum + daysBetweenInclusive(l.startDate, l.endDate),
      0,
    );

    return {
      id: t.id,
      firstName: t.firstName,
      lastName: t.lastName,
      monthlySalary: t.monthlySalary,
      contract: t.contract
        ? {
            type: t.contract.type,
            startDate: t.contract.startDate.toISOString(),
            endDate: t.contract.endDate?.toISOString() ?? null,
            leaveDaysPerYear: t.contract.leaveDaysPerYear,
            bonuses,
          }
        : null,
      leaveBalance: leaveDaysPerYear - daysUsed,
      leaveDaysPerYear,
      leaves: t.leaves
        .slice()
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
        .map((l) => ({
          id: l.id,
          startDate: l.startDate.toISOString(),
          endDate: l.endDate.toISOString(),
          reason: l.reason,
          note: l.note,
          days: daysBetweenInclusive(l.startDate, l.endDate),
        })),
    };
  });

  return (
    <RhView
      teachers={rows}
      schoolName={school?.name ?? "Madrasati"}
      totalPayroll={totalPayroll}
    />
  );
}
