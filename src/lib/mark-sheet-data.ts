import { prisma } from "@/lib/prisma";
import { officialSubjectIndex, schoolLevelOf } from "@/lib/grading";
import { partForKind } from "@/lib/grading-config";
import { currentGradingConfig } from "@/lib/grading-config-data";
import { examKindOf, formulaFor } from "@/lib/report-card-compute";
import { formatCell } from "@/lib/grade-sheet";
import { toSchoolIdentity, type SchoolIdentity } from "@/lib/official-header";
import {
  markSheetColumns,
  orderStudents,
  type MarkSheetColumn,
  type MarkSheetExam,
  type StudentOrder,
} from "@/lib/mark-sheet";

export interface MarkSheetRow {
  number: number;
  name: string;
  /** N° RIM de l'élève, s'il est connu. */
  rim: string | null;
  /** Notes pré-remplies, par clé de colonne (« 12,5 », « abs »). */
  cells: Record<string, string>;
}

export interface MarkSheet {
  subject: string;
  subjectAr: string | null;
  coefficient: number;
  teacher: string | null;
  columns: MarkSheetColumn[];
  rows: MarkSheetRow[];
}

export interface MarkSheetsData {
  school: SchoolIdentity;
  className: string;
  yearLabel: string;
  term: string;
  sheets: MarkSheet[];
}

/**
 * Feuilles de notes d'une classe pour un trimestre : une matière, ou toutes
 * celles de la classe (`subjectId` = "ALL"). Colonnes selon la règle de
 * calcul de l'école pour le cycle de la classe, élèves de la classe avec leur
 * N° de bulletin, enseignant de la matière s'il est connu.
 */
export async function loadMarkSheets(options: {
  schoolId: string;
  classId: string;
  subjectId: string;
  term: string;
  order: StudentOrder;
  prefill: boolean;
}): Promise<MarkSheetsData | null> {
  const { schoolId, classId, subjectId, term, order, prefill } = options;

  const [classRoom, school, rule] = await Promise.all([
    prisma.classRoom.findFirst({
      where: { id: classId, schoolId },
      select: {
        id: true,
        name: true,
        level: true,
        academicYear: { select: { label: true } },
        mainTeacher: { select: { firstName: true, lastName: true } },
        classSubjects: {
          select: {
            subjectId: true,
            coefficientOverride: true,
            subject: { select: { name: true, nameAr: true, coefficient: true, isActive: true } },
            teacher: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.school.findUnique({ where: { id: schoolId } }),
    currentGradingConfig(schoolId),
  ]);
  if (!classRoom || !school) return null;

  const subjects = classRoom.classSubjects
    .filter((cs) => cs.subject.isActive && (subjectId === "ALL" || cs.subjectId === subjectId))
    .sort((a, b) => {
      const ia = officialSubjectIndex(a.subject.name) ?? 99;
      const ib = officialSubjectIndex(b.subject.name) ?? 99;
      return ia - ib || a.subject.name.localeCompare(b.subject.name, "fr");
    });
  if (subjects.length === 0) return null;

  const formula = formulaFor(rule.config, schoolLevelOf(classRoom.level, classRoom.name));

  const [students, exams] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId, classId, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, rimNumber: true },
    }),
    prefill
      ? prisma.exam.findMany({
          where: { schoolId, classId, term, subjectId: { in: subjects.map((s) => s.subjectId) } },
          orderBy: [{ date: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            title: true,
            kind: true,
            subjectId: true,
            grades: { select: { studentId: true, score: true, isAbsent: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  const ordered = orderStudents(students, order);
  // Le professeur principal enseigne les matières sans enseignant attitré
  // (classes du Fondamental) : c'est lui qui recevra la feuille.
  const fullName = (t: { firstName: string; lastName: string } | null) =>
    t ? `${t.firstName} ${t.lastName}`.trim() : null;

  const sheets: MarkSheet[] = subjects.map((cs) => {
    // Même rangement que la grille de saisie : chaque examen sous le bloc
    // qui reçoit son type.
    const own = exams.filter((e) => e.subjectId === cs.subjectId);
    const examsByPart: MarkSheetExam[][] = formula.parts.map(() => []);
    const grades = new Map<string, { score: number | null; isAbsent: boolean }>();
    for (const exam of own) {
      const part = partForKind(formula, examKindOf(exam));
      if (!part) continue;
      examsByPart[formula.parts.indexOf(part)].push({ id: exam.id, title: exam.title });
      for (const g of exam.grades) grades.set(`${exam.id}:${g.studentId}`, g);
    }
    const columns = markSheetColumns(formula, examsByPart, prefill);
    return {
      subject: cs.subject.name,
      subjectAr: cs.subject.nameAr,
      coefficient: cs.coefficientOverride ?? cs.subject.coefficient,
      teacher: fullName(cs.teacher) ?? fullName(classRoom.mainTeacher),
      columns,
      rows: ordered.map((s) => ({
        number: s.number,
        name: `${s.firstName} ${s.lastName}`.trim(),
        rim: s.rimNumber,
        cells: Object.fromEntries(
          columns
            .filter((c) => c.examId)
            .map((c) => [c.key, formatCell(grades.get(`${c.examId}:${s.id}`))])
            .filter(([, v]) => v),
        ),
      })),
    };
  });

  return {
    school: toSchoolIdentity(school),
    className: classRoom.name,
    yearLabel: classRoom.academicYear.label,
    term,
    sheets,
  };
}
