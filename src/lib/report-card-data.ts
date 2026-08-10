import { prisma } from "@/lib/prisma";
import {
  weightedAverage,
  mentionFor,
  rankOf,
  type SubjectResult,
} from "@/lib/report-card";

export interface ReportCard {
  student: { id: string; firstName: string; lastName: string };
  className: string;
  term: string;
  results: SubjectResult[];
  average: number | null;
  mention: string;
  rank: number | null;
  classSize: number;
  attendance: { present: number; absent: number; late: number };
}

/**
 * Construit les bulletins de tous les élèves d'une classe pour un trimestre.
 * Les moyennes par matière sont ramenées sur 20 pour rester comparables même
 * si les examens ont des notes maximales différentes.
 */
export async function buildReportCards(
  schoolId: string,
  classId: string,
  term: string,
): Promise<ReportCard[]> {
  const [classRoom, students, exams, attendanceCounts] = await Promise.all([
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
      include: { grades: true, subject: true },
    }),
    prisma.attendanceRecord.groupBy({
      by: ["studentId", "status"],
      where: { schoolId, classId },
      _count: { _all: true },
    }),
  ]);

  if (!classRoom) return [];

  const subjects = classRoom.classSubjects.map((cs) => ({
    id: cs.subjectId,
    name: cs.subject.name,
    coefficient: cs.coefficientOverride ?? cs.subject.coefficient,
  }));

  // Moyenne de la classe par matière, sur 20.
  const classAverageBySubject = new Map<string, number | null>();
  for (const subject of subjects) {
    const subjectExams = exams.filter((e) => e.subjectId === subject.id);
    const normalized: number[] = [];
    for (const exam of subjectExams) {
      for (const g of exam.grades) {
        if (g.isAbsent || g.score == null) continue;
        normalized.push((g.score / exam.maxScore) * 20);
      }
    }
    classAverageBySubject.set(
      subject.id,
      normalized.length > 0
        ? normalized.reduce((a, b) => a + b, 0) / normalized.length
        : null,
    );
  }

  const attendanceByStudent = new Map<
    string,
    { present: number; absent: number; late: number }
  >();
  for (const row of attendanceCounts) {
    const entry =
      attendanceByStudent.get(row.studentId) ?? { present: 0, absent: 0, late: 0 };
    if (row.status === "PRESENT") entry.present += row._count._all;
    else if (row.status === "ABSENT") entry.absent += row._count._all;
    else if (row.status === "LATE") entry.late += row._count._all;
    attendanceByStudent.set(row.studentId, entry);
  }

  const cardsWithoutRank = students.map((student) => {
    const results: SubjectResult[] = subjects.map((subject) => {
      const subjectExams = exams.filter((e) => e.subjectId === subject.id);
      const normalized: number[] = [];
      for (const exam of subjectExams) {
        const grade = exam.grades.find((g) => g.studentId === student.id);
        if (!grade || grade.isAbsent || grade.score == null) continue;
        normalized.push((grade.score / exam.maxScore) * 20);
      }
      return {
        subjectName: subject.name,
        coefficient: subject.coefficient,
        average:
          normalized.length > 0
            ? normalized.reduce((a, b) => a + b, 0) / normalized.length
            : null,
        classAverage: classAverageBySubject.get(subject.id) ?? null,
        examCount: normalized.length,
      };
    });

    const average = weightedAverage(results);

    return {
      student,
      className: classRoom.name,
      term,
      results,
      average,
      mention: mentionFor(average),
      attendance:
        attendanceByStudent.get(student.id) ?? { present: 0, absent: 0, late: 0 },
    };
  });

  const allAverages = cardsWithoutRank
    .map((c) => c.average)
    .filter((a): a is number => a != null);

  return cardsWithoutRank.map((card) => ({
    ...card,
    rank: rankOf(card.average, allAverages),
    classSize: students.length,
  }));
}
