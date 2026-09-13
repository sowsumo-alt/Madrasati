import type { Prisma } from "@prisma/client";
import { examStatus } from "@/lib/exams";
import type { ExamRow } from "./exams-view";

/** Relations chargées pour chaque examen, communes aux pages du directeur et de l'enseignant. */
export const EXAM_ROW_INCLUDE = {
  classRoom: {
    select: {
      name: true,
      classSubjects: { select: { subjectId: true, coefficientOverride: true } },
    },
  },
  subject: { select: { name: true, coefficient: true } },
  grades: true,
} satisfies Prisma.ExamInclude;

type ExamWithRelations = Prisma.ExamGetPayload<{ include: typeof EXAM_ROW_INCLUDE }>;

export interface ExamStudent {
  id: string;
  firstName: string;
  lastName: string;
  classId: string | null;
  parentLinks: { parent: { firstName: string; lastName: string; phone: string } }[];
}

/**
 * Lignes de la liste des examens : avancement de la saisie, moyenne, élèves à
 * noter et état (planifié, en cours, terminé). L'état est calculé ici, côté
 * serveur, pour que la page s'affiche à l'identique dans le navigateur — sinon
 * un examen commençant pile entre les deux rendus changerait d'étiquette.
 */
export function toExamRows(
  exams: ExamWithRelations[],
  students: ExamStudent[],
  now: Date,
): ExamRow[] {
  return exams.map((e) => {
    const classStudents = students.filter((s) => s.classId === e.classId);
    const gradeByStudent = new Map(e.grades.map((g) => [g.studentId, g]));

    const scores = e.grades
      .filter((g) => !g.isAbsent && g.score != null)
      .map((g) => g.score as number);
    const average =
      scores.length > 0 ? scores.reduce((sum, n) => sum + n, 0) / scores.length : null;

    const override = e.classRoom.classSubjects.find(
      (cs) => cs.subjectId === e.subjectId,
    )?.coefficientOverride;

    return {
      id: e.id,
      title: e.title,
      kind: e.kind,
      term: e.term,
      date: e.date.toISOString(),
      startMinutes: e.startMinutes,
      durationMinutes: e.durationMinutes,
      instructions: e.instructions,
      maxScore: e.maxScore,
      // Coefficient réellement appliqué sur le bulletin : celui de la classe
      // s'il y est redéfini, sinon celui de la matière.
      coefficient: override ?? e.subject.coefficient,
      classId: e.classId,
      className: e.classRoom.name,
      subjectId: e.subjectId,
      subjectName: e.subject.name,
      status: examStatus(e, now),
      gradedCount: e.grades.filter((g) => g.score != null || g.isAbsent).length,
      studentCount: classStudents.length,
      average,
      students: classStudents.map((s) => {
        const grade = gradeByStudent.get(s.id);
        const parent = s.parentLinks[0]?.parent;
        return {
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          score: grade?.score ?? null,
          isAbsent: grade?.isAbsent ?? false,
          parentName: parent ? `${parent.firstName} ${parent.lastName}` : null,
          parentPhone: parent?.phone ?? null,
        };
      }),
    };
  });
}
