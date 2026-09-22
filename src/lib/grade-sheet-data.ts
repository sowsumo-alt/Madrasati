import { prisma } from "@/lib/prisma";
import { CURRENT_YEAR } from "@/lib/school-year";
import { defaultTermForDate } from "@/lib/exams";
import {
  gradingSchemeFor,
  officialSubjectIndex,
  schoolLevelOf,
  type GradingScheme,
  type SchoolLevel,
} from "@/lib/grading";
import { partForKind, type Formula } from "@/lib/grading-config";
import { currentGradingConfig } from "@/lib/grading-config-data";
import { examKindOf, formulaFor } from "@/lib/report-card-compute";
import { TERMS } from "@/app/directeur/examens/schema";

export interface GradeSheetColumn {
  id: string;
  title: string;
  /** Date ISO. */
  date: string;
  maxScore: number;
}

/** Un bloc de la formule de l'école et les notes déjà saisies pour lui. */
export interface GradeSheetPart {
  id: string;
  label: string;
  weight: number;
  multiple: string;
  required: boolean;
  columns: GradeSheetColumn[];
}

export interface GradeSheetData {
  classes: { id: string; name: string; level: SchoolLevel | null; scheme: GradingScheme }[];
  classId: string | null;
  subjects: { id: string; name: string; coefficient: number }[];
  subjectId: string | null;
  term: (typeof TERMS)[number];
  students: { id: string; firstName: string; lastName: string }[];
  /** La règle de calcul de l'école pour le cycle de cette classe. */
  formula: Formula;
  parts: GradeSheetPart[];
  /** Notes enregistrées, par `${examId}:${studentId}`. */
  grades: Record<string, { score: number | null; isAbsent: boolean }>;
  /** Faux pour un enseignant qui n'enseigne pas cette matière. */
  canAddColumn: boolean;
}

/**
 * Données de la grille de saisie : les classes de l'année visibles par
 * l'utilisateur, puis, pour la matière et le trimestre choisis, une colonne
 * par note déjà saisie, rangée sous le bloc de la formule qui la reçoit.
 *
 * Les blocs viennent de la configuration de l'école : une école qui compte
 * « meilleur devoir × 3 + composition » voit deux blocs, une école qui fait
 * la moyenne de ses devoirs en voit un seul.
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

  const [classRows, rule] = await Promise.all([
    prisma.classRoom.findMany({
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
    }),
    currentGradingConfig(schoolId),
  ]);

  const classes = classRows.map((c) => {
    const level = schoolLevelOf(c.level, c.name);
    return { id: c.id, name: c.name, level, scheme: gradingSchemeFor(level) };
  });

  // Par défaut, la première classe du collège ou du lycée : c'est pour elles
  // que la grille a été dessinée.
  const selected =
    classRows.find((c) => c.id === params.classe) ??
    classRows.find((c) => classes.find((x) => x.id === c.id)?.scheme === "SECONDARY") ??
    classRows[0] ??
    null;

  const term = (TERMS as readonly string[]).includes(params.trimestre ?? "")
    ? (params.trimestre as (typeof TERMS)[number])
    : defaultTermForDate(new Date());

  const level = selected ? schoolLevelOf(selected.level, selected.name) : null;
  const formula = formulaFor(rule.config, level);
  const partsOf = (columnsByPart: GradeSheetColumn[][]): GradeSheetPart[] =>
    formula.parts.map((p, index) => ({
      id: p.id,
      label: p.label,
      weight: p.weight,
      multiple: p.multiple,
      required: p.required,
      columns: columnsByPart[index] ?? [],
    }));

  const empty: GradeSheetData = {
    classes,
    classId: selected?.id ?? null,
    subjects: [],
    subjectId: null,
    term,
    students: [],
    formula,
    parts: partsOf([]),
    grades: {},
    canAddColumn: false,
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
  const base = { ...empty, subjects, subjectId: subject?.id ?? null };
  if (!subject) return base;

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

  // Chaque examen rejoint le bloc qui accepte son type ; ceux qu'aucun bloc
  // ne prend (type retiré de la formule) restent visibles dans Examens.
  const columnsByPart: GradeSheetColumn[][] = formula.parts.map(() => []);
  const grades: GradeSheetData["grades"] = {};
  for (const exam of exams) {
    const part = partForKind(formula, examKindOf(exam));
    if (!part) continue;
    columnsByPart[formula.parts.indexOf(part)].push({
      id: exam.id,
      title: exam.title,
      date: exam.date.toISOString(),
      maxScore: exam.maxScore,
    });
    for (const g of exam.grades) {
      grades[`${exam.id}:${g.studentId}`] = { score: g.score, isAbsent: g.isAbsent };
    }
  }

  const classSubject = selected.classSubjects.find((cs) => cs.subjectId === subject.id);
  return {
    ...base,
    students,
    parts: partsOf(columnsByPart),
    grades,
    canAddColumn: teachesAll || classSubject?.teacherId === teacherId,
  };
}
