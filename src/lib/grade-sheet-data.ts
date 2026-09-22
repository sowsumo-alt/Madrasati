import { prisma } from "@/lib/prisma";
import { CURRENT_YEAR } from "@/lib/school-year";
import { defaultTermForDate } from "@/lib/exams";
import {
  gradingSchemeFor,
  isCompositionExam,
  officialSubjectIndex,
  schoolLevelOf,
  type GradingScheme,
  type SchoolLevel,
} from "@/lib/grading";
import { TERMS } from "@/app/directeur/examens/schema";

export interface GradeSheetColumn {
  id: string;
  title: string;
  /** Date ISO. */
  date: string;
  maxScore: number;
}

export interface GradeSheetData {
  classes: { id: string; name: string; level: SchoolLevel | null; scheme: GradingScheme }[];
  classId: string | null;
  subjects: { id: string; name: string; coefficient: number }[];
  subjectId: string | null;
  term: (typeof TERMS)[number];
  students: { id: string; firstName: string; lastName: string }[];
  devoirs: GradeSheetColumn[];
  composition: GradeSheetColumn | null;
  /** Notes enregistrées, par `${examId}:${studentId}`. */
  grades: Record<string, { score: number | null; isAbsent: boolean }>;
  /** Faux pour un enseignant qui n'enseigne pas cette matière. */
  canAddDevoir: boolean;
}

/**
 * Données de la grille de saisie Devoirs / Composition : les classes de
 * l'année visibles par l'utilisateur, puis les devoirs, la composition et les
 * notes de la matière et du trimestre choisis.
 *
 * `teacherId` renseigné : la vue d'un enseignant, limitée aux matières qu'il
 * enseigne — toutes celles de la classe dont il est professeur principal.
 */
export async function loadGradeSheet(options: {
  schoolId: string;
  /** Classes autorisées ; absent pour le directeur, qui voit toute l'école. */
  classIds?: string[];
  teacherId?: string;
  params: { classe?: string; matiere?: string; trimestre?: string };
}): Promise<GradeSheetData> {
  const { schoolId, classIds, teacherId, params } = options;

  const classRows = await prisma.classRoom.findMany({
    where: {
      schoolId,
      ...CURRENT_YEAR,
      ...(classIds ? { id: { in: classIds } } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      level: true,
      mainTeacherId: true,
      classSubjects: {
        select: {
          subjectId: true,
          teacherId: true,
          coefficientOverride: true,
          subject: { select: { name: true, coefficient: true, isActive: true } },
        },
      },
    },
  });

  const classes = classRows.map((c) => {
    const level = schoolLevelOf(c.level, c.name);
    return { id: c.id, name: c.name, level, scheme: gradingSchemeFor(level) };
  });

  // Par défaut, la première classe du collège ou du lycée : c'est pour elles
  // que la grille existe.
  const selected =
    classRows.find((c) => c.id === params.classe) ??
    classRows.find((c) => classes.find((x) => x.id === c.id)?.scheme === "SECONDARY") ??
    classRows[0] ??
    null;

  const term = (TERMS as readonly string[]).includes(params.trimestre ?? "")
    ? (params.trimestre as (typeof TERMS)[number])
    : defaultTermForDate(new Date());

  const empty: GradeSheetData = {
    classes,
    classId: selected?.id ?? null,
    subjects: [],
    subjectId: null,
    term,
    students: [],
    devoirs: [],
    composition: null,
    grades: {},
    canAddDevoir: false,
  };
  if (!selected) return empty;

  const teachesAll = !teacherId || selected.mainTeacherId === teacherId;
  const subjects = selected.classSubjects
    .filter((cs) => cs.subject.isActive && (teachesAll || cs.teacherId === teacherId))
    .map((cs) => ({
      id: cs.subjectId,
      name: cs.subject.name,
      coefficient: cs.coefficientOverride ?? cs.subject.coefficient,
    }))
    .sort((a, b) => {
      const ia = officialSubjectIndex(a.name) ?? 99;
      const ib = officialSubjectIndex(b.name) ?? 99;
      return ia - ib || a.name.localeCompare(b.name, "fr");
    });

  const subject = subjects.find((s) => s.id === params.matiere) ?? subjects[0] ?? null;
  const base = { ...empty, subjects, subjectId: subject?.id ?? null, canAddDevoir: true };
  if (!subject || classes.find((c) => c.id === selected.id)?.scheme !== "SECONDARY") return base;

  const [students, exams] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId, classId: selected.id, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.exam.findMany({
      where: { schoolId, classId: selected.id, subjectId: subject.id, term },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        kind: true,
        date: true,
        maxScore: true,
        grades: { select: { studentId: true, score: true, isAbsent: true } },
      },
    }),
  ]);

  const toColumn = (e: (typeof exams)[number]): GradeSheetColumn => ({
    id: e.id,
    title: e.title,
    date: e.date.toISOString(),
    maxScore: e.maxScore,
  });
  const compositions = exams.filter((e) => isCompositionExam(e));
  // Une seule composition par trimestre ; la plus récente fait foi, comme
  // dans le calcul du bulletin.
  const composition = compositions.at(-1) ?? null;
  const shown = [...exams.filter((e) => !isCompositionExam(e)), ...(composition ? [composition] : [])];

  const grades: GradeSheetData["grades"] = {};
  for (const exam of shown) {
    for (const g of exam.grades) {
      grades[`${exam.id}:${g.studentId}`] = { score: g.score, isAbsent: g.isAbsent };
    }
  }

  const classSubject = selected.classSubjects.find((cs) => cs.subjectId === subject.id);
  return {
    ...base,
    students,
    devoirs: exams.filter((e) => !isCompositionExam(e)).map(toColumn),
    composition: composition ? toColumn(composition) : null,
    grades,
    canAddDevoir: teachesAll || classSubject?.teacherId === teacherId,
  };
}
