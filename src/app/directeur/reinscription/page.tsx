import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { ReenrollView, type ReenrollStudent, type ReenrollClassOption } from "./reenroll-view";
import { isDecisionKey } from "@/lib/annual-decision";

export default async function ReenrollmentPage() {
  const user = await requireRole(ROLES.DIRECTOR);

  const currentYear = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isCurrent: true },
  });

  const [targetClasses, oldStudents] = await Promise.all([
    currentYear
      ? prisma.classRoom.findMany({
          where: { schoolId: user.schoolId, academicYearId: currentYear.id },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    currentYear
      ? prisma.student.findMany({
          where: {
            schoolId: user.schoolId,
            status: "ACTIVE",
            classRoom: { academicYearId: { not: currentYear.id } },
          },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          include: { classRoom: { include: { academicYear: true } } },
        })
      : Promise.resolve([]),
  ]);

  // Fin d'année validée sur le bulletin annuel : moyenne et décision de
  // passage, affichées pour aider le directeur — jamais appliquées d'office.
  const decisions = await prisma.annualDecision.findMany({
    where: { schoolId: user.schoolId, studentId: { in: oldStudents.map((s) => s.id) } },
    select: { studentId: true, academicYearId: true, decision: true, average: true },
  });
  const decisionOf = (studentId: string, academicYearId: string | undefined) =>
    decisions.find((d) => d.studentId === studentId && d.academicYearId === academicYearId);

  const students: ReenrollStudent[] = oldStudents.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    classId: s.classId,
    className: s.classRoom?.name ?? null,
    yearLabel: s.classRoom?.academicYear.label ?? null,
    annual: (() => {
      const d = decisionOf(s.id, s.classRoom?.academicYearId);
      if (!d) return null;
      return {
        average: d.average,
        decision: isDecisionKey(d.decision) ? d.decision : null,
      };
    })(),
  }));

  const targetClassOptions: ReenrollClassOption[] = targetClasses;

  return (
    <ReenrollView
      students={students}
      targetClasses={targetClassOptions}
      hasCurrentYear={Boolean(currentYear)}
    />
  );
}
