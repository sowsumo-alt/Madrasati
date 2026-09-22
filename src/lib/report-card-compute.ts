import {
  weightedAverage,
  mentionFor,
  rankOf,
  type SubjectResult,
  type MentionKey,
} from "@/lib/report-card";
import {
  generalAverage,
  gradingSchemeFor,
  isCompositionExam,
  onTwenty,
  roundHundredth,
  schoolLevelOf,
  secondarySubjectAverage,
  weightedScore,
  type GradingScheme,
  type SchoolLevel,
} from "@/lib/grading";

/**
 * Calcul des bulletins d'une classe à partir de données déjà chargées — sans
 * accès à la base, pour être testé à part (tests/report-card-compute.test.ts).
 * Le chargement vit dans report-card-data.ts.
 *
 * La formule dépend du niveau de la classe (voir lib/grading.ts) :
 * collège et lycée suivent le bulletin officiel (meilleur devoir × 3 +
 * composition, ÷ 4) ; le Fondamental garde le calcul d'origine.
 */

export interface ReportCardAttendance {
  present: number;
  absent: number;
  late: number;
}

/** Détail d'une matière au collège et au lycée, pour le bulletin officiel. */
export interface SecondarySubjectDetail {
  /** Tous les devoirs du trimestre, dans l'ordre chronologique. */
  devoirs: { title: string; score: number | null; isAbsent: boolean }[];
  /** Index du devoir retenu dans `devoirs` ; null sans devoir noté. */
  bestIndex: number | null;
  best: number | null;
  bestTimes3: number | null;
  composition: number | null;
  compositionAbsent: boolean;
  /** Note × Coeff ; null tant que la moyenne de la matière manque. */
  weighted: number | null;
  /** Rang de l'élève dans la matière. */
  rank: number | null;
  /** Observation du professeur, saisie avec la note de composition. */
  observation: string | null;
}

export type ReportCardSubject = SubjectResult & { secondary?: SecondarySubjectDetail };

export interface ReportCard {
  student: { id: string; firstName: string; lastName: string };
  className: string;
  term: string;
  /** Niveau reconnu de la classe ; null s'il ne suit pas la nomenclature. */
  schoolLevel: SchoolLevel | null;
  scheme: GradingScheme;
  results: ReportCardSubject[];
  average: number | null;
  /** Somme des coefficients des matières moyennées (secondaire). */
  totalCoefficients: number;
  /** Somme des notes coefficientées (secondaire) ; null au Fondamental. */
  totalPoints: number | null;
  mention: MentionKey;
  rank: number | null;
  classSize: number;
  attendance: ReportCardAttendance;
}

export interface ReportCardExam {
  subjectId: string;
  title: string;
  kind: string | null;
  date: Date;
  maxScore: number;
  grades: { studentId: string; score: number | null; isAbsent: boolean; comment: string | null }[];
}

export interface ReportCardInput {
  className: string;
  classLevel: string;
  term: string;
  subjects: { id: string; name: string; nameAr: string | null; coefficient: number }[];
  students: { id: string; firstName: string; lastName: string }[];
  exams: ReportCardExam[];
  attendance: Map<string, ReportCardAttendance>;
}

const NO_ATTENDANCE: ReportCardAttendance = { present: 0, absent: 0, late: 0 };

export function computeReportCards(input: ReportCardInput): ReportCard[] {
  const schoolLevel = schoolLevelOf(input.classLevel, input.className);
  const scheme = gradingSchemeFor(schoolLevel);
  return scheme === "SECONDARY"
    ? secondaryCards(input, schoolLevel)
    : standardCards(input, schoolLevel);
}

function mean(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** Classement final : le rang de chaque élève parmi les moyennes de la classe. */
function withRanks(
  cards: Omit<ReportCard, "rank" | "classSize">[],
  classSize: number,
): ReportCard[] {
  const allAverages = cards.map((c) => c.average).filter((a): a is number => a != null);
  return cards.map((card) => ({
    ...card,
    rank: rankOf(card.average, allAverages),
    classSize,
  }));
}

/**
 * Fondamental et classes au niveau non reconnu : le calcul d'origine de
 * Madrasati, inchangé. Chaque matière est la moyenne simple de toutes ses
 * notes ramenées sur 20 — devoirs et compositions confondus —, puis la
 * moyenne générale est pondérée par les coefficients.
 */
function standardCards(input: ReportCardInput, schoolLevel: SchoolLevel | null): ReportCard[] {
  const { subjects, students, exams } = input;

  // Moyenne de la classe par matière, sur 20.
  const classAverageBySubject = new Map<string, number | null>();
  for (const subject of subjects) {
    const normalized: number[] = [];
    for (const exam of exams.filter((e) => e.subjectId === subject.id)) {
      for (const g of exam.grades) {
        if (g.isAbsent || g.score == null) continue;
        normalized.push((g.score / exam.maxScore) * 20);
      }
    }
    classAverageBySubject.set(subject.id, mean(normalized));
  }

  const cards = students.map((student) => {
    const results: ReportCardSubject[] = subjects.map((subject) => {
      const normalized: number[] = [];
      for (const exam of exams.filter((e) => e.subjectId === subject.id)) {
        const grade = exam.grades.find((g) => g.studentId === student.id);
        if (!grade || grade.isAbsent || grade.score == null) continue;
        normalized.push((grade.score / exam.maxScore) * 20);
      }
      return {
        subjectName: subject.name,
        subjectNameAr: subject.nameAr,
        coefficient: subject.coefficient,
        average: mean(normalized),
        classAverage: classAverageBySubject.get(subject.id) ?? null,
        examCount: normalized.length,
      };
    });

    const average = weightedAverage(results);
    const scored = results.filter((r) => r.average != null);

    return {
      student,
      className: input.className,
      term: input.term,
      schoolLevel,
      scheme: "STANDARD" as const,
      results,
      average,
      totalCoefficients: scored.reduce((sum, r) => sum + r.coefficient, 0),
      totalPoints: null,
      mention: mentionFor(average),
      attendance: input.attendance.get(student.id) ?? NO_ATTENDANCE,
    };
  });

  return withRanks(cards, students.length);
}

/**
 * Collège et lycée : dans chaque matière, (meilleur devoir × 3 +
 * composition) ÷ 4, puis la moyenne générale = somme des notes
 * coefficientées ÷ somme des coefficients.
 */
function secondaryCards(input: ReportCardInput, schoolLevel: SchoolLevel | null): ReportCard[] {
  const { subjects, students } = input;
  // Ordre chronologique : « Devoir 1 » avant « Devoir 2 » sur le bulletin.
  const exams = [...input.exams].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.title.localeCompare(b.title),
  );

  // detailsBySubject[subjectId][studentId]
  const detailsBySubject = new Map<string, Map<string, SecondarySubjectDetail & { average: number | null }>>();

  for (const subject of subjects) {
    const subjectExams = exams.filter((e) => e.subjectId === subject.id);
    const devoirExams = subjectExams.filter((e) => !isCompositionExam(e));
    // Une seule composition par trimestre. Si une école en a saisi plusieurs,
    // la plus récente fait foi.
    const compositionExams = subjectExams.filter((e) => isCompositionExam(e)).reverse();

    const byStudent = new Map<string, SecondarySubjectDetail & { average: number | null }>();
    for (const student of students) {
      const devoirs = devoirExams.map((exam) => {
        const grade = exam.grades.find((g) => g.studentId === student.id);
        const score =
          grade && !grade.isAbsent && grade.score != null
            ? onTwenty(grade.score, exam.maxScore)
            : null;
        return { title: exam.title, score, isAbsent: Boolean(grade?.isAbsent) };
      });

      let composition: number | null = null;
      let compositionAbsent = false;
      let observation: string | null = null;
      for (const exam of compositionExams) {
        const grade = exam.grades.find((g) => g.studentId === student.id);
        if (!grade) continue;
        if (grade.isAbsent || grade.score == null) {
          compositionAbsent ||= grade.isAbsent;
          continue;
        }
        composition = onTwenty(grade.score, exam.maxScore);
        compositionAbsent = false;
        observation = grade.comment?.trim() || null;
        break;
      }

      const calc = secondarySubjectAverage(
        devoirs.map((d) => d.score),
        composition,
      );
      byStudent.set(student.id, {
        devoirs,
        bestIndex: calc.bestIndex,
        best: calc.best,
        bestTimes3: calc.bestTimes3,
        composition,
        compositionAbsent,
        average: calc.average,
        weighted: calc.average == null ? null : weightedScore(calc.average, subject.coefficient),
        rank: null,
        observation,
      });
    }

    // Rang dans la matière et moyenne de la classe, sur les seules moyennes
    // complètes.
    const averages = [...byStudent.values()]
      .map((d) => d.average)
      .filter((a): a is number => a != null);
    for (const detail of byStudent.values()) detail.rank = rankOf(detail.average, averages);

    detailsBySubject.set(subject.id, byStudent);
  }

  const classAverageBySubject = new Map(
    subjects.map((subject) => {
      const averages = [...(detailsBySubject.get(subject.id)?.values() ?? [])]
        .map((d) => d.average)
        .filter((a): a is number => a != null);
      return [subject.id, mean(averages)] as const;
    }),
  );

  const cards = students.map((student) => {
    const results: ReportCardSubject[] = subjects.map((subject) => {
      const { average, ...secondary } = detailsBySubject.get(subject.id)!.get(student.id)!;
      return {
        subjectName: subject.name,
        subjectNameAr: subject.nameAr,
        coefficient: subject.coefficient,
        average,
        classAverage: classAverageBySubject.get(subject.id) ?? null,
        examCount:
          secondary.devoirs.filter((d) => d.score != null).length +
          (secondary.composition != null ? 1 : 0),
        secondary,
      };
    });

    const general = generalAverage(results);
    // Arrondie au centième comme sur le bulletin : la mention et le rang
    // suivent la moyenne que les parents lisent, pas une décimale cachée.
    const average = general.average == null ? null : roundHundredth(general.average);

    return {
      student,
      className: input.className,
      term: input.term,
      schoolLevel,
      scheme: "SECONDARY" as const,
      results,
      average,
      totalCoefficients: general.totalCoefficients,
      totalPoints: average == null ? null : general.totalPoints,
      mention: mentionFor(average),
      attendance: input.attendance.get(student.id) ?? NO_ATTENDANCE,
    };
  });

  return withRanks(cards, students.length);
}
