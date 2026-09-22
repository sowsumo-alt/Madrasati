import { prisma } from "@/lib/prisma";
import { termDateRange } from "@/lib/report-card";
import {
  computeReportCards,
  type ReportCard,
  type ReportCardAttendance,
} from "@/lib/report-card-compute";

export type { ReportCard } from "@/lib/report-card-compute";

/**
 * Construit les bulletins de tous les élèves d'une classe pour un trimestre.
 * Les moyennes par matière sont ramenées sur 20 pour rester comparables même
 * si les examens ont des notes maximales différentes.
 *
 * La formule suit le niveau de la classe — bulletin officiel au collège et
 * au lycée, calcul d'origine au Fondamental : voir lib/report-card-compute.ts.
 */
export async function buildReportCards(
  schoolId: string,
  classId: string,
  term: string,
): Promise<ReportCard[]> {
  const [classRoom, students, exams, academicYear] = await Promise.all([
    prisma.classRoom.findFirst({
      where: { id: classId, schoolId },
      include: {
        classSubjects: { include: { subject: true } },
      },
    }),
    prisma.student.findMany({
      where: { schoolId, classId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.exam.findMany({
      where: { schoolId, classId, term },
      select: {
        subjectId: true,
        title: true,
        kind: true,
        date: true,
        maxScore: true,
        grades: { select: { studentId: true, score: true, isAbsent: true, comment: true } },
      },
    }),
    prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } }),
  ]);

  if (!classRoom) return [];

  // Les présences comptabilisées se limitent à la période du trimestre
  // demandé, pas au cumul de toute l'année scolaire. Sans année active, la
  // plage reste vide plutôt que de remonter tout l'historique par erreur.
  const attendanceRange = academicYear
    ? termDateRange(academicYear, term)
    : { start: new Date(0), end: new Date(0) };
  const attendanceCounts = await prisma.attendanceRecord.groupBy({
    by: ["studentId", "status"],
    where: { schoolId, classId, date: { gte: attendanceRange.start, lte: attendanceRange.end } },
    _count: { _all: true },
  });

  const attendance = new Map<string, ReportCardAttendance>();
  for (const row of attendanceCounts) {
    const entry = attendance.get(row.studentId) ?? { present: 0, absent: 0, late: 0 };
    if (row.status === "PRESENT") entry.present += row._count._all;
    else if (row.status === "ABSENT") entry.absent += row._count._all;
    else if (row.status === "LATE") entry.late += row._count._all;
    attendance.set(row.studentId, entry);
  }

  return computeReportCards({
    className: classRoom.name,
    classLevel: classRoom.level,
    term,
    subjects: classRoom.classSubjects.map((cs) => ({
      id: cs.subjectId,
      name: cs.subject.name,
      nameAr: cs.subject.nameAr,
      coefficient: cs.coefficientOverride ?? cs.subject.coefficient,
    })),
    students,
    exams,
    attendance,
  });
}
