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
  onTwenty,
  roundHundredth,
  schoolLevelOf,
  weightedScore,
  type GradingScheme,
  type SchoolLevel,
} from "@/lib/grading";
import {
  computeSubjectAverage,
  defaultGradingConfig,
  partForKind,
  type AnnualFormula,
  type Formula,
  type GradingConfig,
  type PartResult,
} from "@/lib/grading-config";

/**
 * Calcul des bulletins d'une classe à partir de données déjà chargées — sans
 * accès à la base, pour être testé à part (tests/report-card-compute.test.ts).
 * Le chargement vit dans report-card-data.ts.
 *
 * La formule n'est pas écrite ici : elle vient de la configuration de
 * l'école (lib/grading-config.ts), qui a une règle pour le collège et le
 * lycée et une autre pour le Fondamental. Deux écoles voisines peuvent donc
 * calculer différemment les mêmes notes.
 */

export interface ReportCardAttendance {
  present: number;
  absent: number;
  late: number;
}

/** Détail d'une matière : ce que chaque bloc de la formule a donné. */
export interface SubjectDetail {
  /** Un résultat par bloc de la formule, dans son ordre. */
  parts: PartResult[];
  /** Titres des examens de chaque bloc, pour les nommer sur le bulletin. */
  titles: string[][];
  /** Rang de l'élève dans la matière. */
  rank: number | null;
  /** Observation du professeur, saisie avec la note de fin (composition). */
  observation: string | null;
}

export type ReportCardSubject = SubjectResult & { detail: SubjectDetail };

export interface ReportCard {
  student: { id: string; firstName: string; lastName: string };
  className: string;
  term: string;
  /** Niveau reconnu de la classe ; null s'il ne suit pas la nomenclature. */
  schoolLevel: SchoolLevel | null;
  /** Modèle de bulletin : officiel du secondaire, ou bulletin d'origine. */
  scheme: GradingScheme;
  /** La règle appliquée, telle que configurée par l'école. */
  formula: Formula;
  results: ReportCardSubject[];
  average: number | null;
  /** Somme des coefficients des matières moyennées. */
  totalCoefficients: number;
  /** Somme des notes coefficientées ; null au Fondamental. */
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
  /** Règle de l'école ; le modèle par défaut si elle n'en a pas défini. */
  config?: GradingConfig;
}

const NO_ATTENDANCE: ReportCardAttendance = { present: 0, absent: 0, late: 0 };

/**
 * Type d'un examen : celui qui a été choisi à sa création, ou, pour les
 * examens saisis avant ce champ, celui que dit son titre.
 */
export function examKindOf(exam: { kind: string | null; title: string }): string {
  if (exam.kind) return exam.kind;
  return /compo/i.test(exam.title) ? "COMPOSITION" : "DEVOIR";
}

/** La formule que suit une classe, d'après son niveau. */
export function formulaFor(config: GradingConfig, level: SchoolLevel | null): Formula {
  return gradingSchemeFor(level) === "SECONDARY" ? config.secondary : config.fundamental;
}

function mean(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function computeReportCards(input: ReportCardInput): ReportCard[] {
  const config = input.config ?? defaultGradingConfig();
  const schoolLevel = schoolLevelOf(input.classLevel, input.className);
  const scheme = gradingSchemeFor(schoolLevel);
  const formula = formulaFor(config, schoolLevel);
  const { subjects, students } = input;

  // Ordre chronologique : « Devoir 1 » avant « Devoir 2 » sur le bulletin.
  const exams = [...input.exams].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.title.localeCompare(b.title),
  );
  // Chaque examen ne nourrit qu'un seul bloc de la formule : sans cela, une
  // note pourrait compter deux fois.
  const partIndexOfExam = new Map<ReportCardExam, number>();
  for (const exam of exams) {
    const part = partForKind(formula, examKindOf(exam));
    if (part) partIndexOfExam.set(exam, formula.parts.indexOf(part));
  }

  const detailsBySubject = new Map<string, Map<string, SubjectDetail & { average: number | null }>>();

  for (const subject of subjects) {
    const subjectExams = exams.filter((e) => e.subjectId === subject.id);
    const examsByPart = formula.parts.map((_, index) =>
      subjectExams.filter((e) => partIndexOfExam.get(e) === index),
    );

    const byStudent = new Map<string, SubjectDetail & { average: number | null }>();
    for (const student of students) {
      const scoresByPart = examsByPart.map((list) =>
        list.map((exam) => {
          const grade = exam.grades.find((g) => g.studentId === student.id);
          return grade && !grade.isAbsent && grade.score != null
            ? onTwenty(grade.score, exam.maxScore)
            : null;
        }),
      );
      const computed = computeSubjectAverage(formula, scoresByPart);

      // L'observation accompagne la note de fin de trimestre : celle du
      // dernier bloc qui en a une.
      let observation: string | null = null;
      for (let i = examsByPart.length - 1; i >= 0 && !observation; i--) {
        for (const exam of [...examsByPart[i]].reverse()) {
          const grade = exam.grades.find((g) => g.studentId === student.id);
          const comment = grade?.comment?.trim();
          if (comment) { observation = comment; break; }
        }
      }

      byStudent.set(student.id, {
        parts: computed.parts,
        titles: examsByPart.map((list) => list.map((e) => e.title)),
        rank: null,
        observation,
        average: computed.average,
      });
    }

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
      const { average, ...detail } = detailsBySubject.get(subject.id)!.get(student.id)!;
      return {
        subjectName: subject.name,
        subjectNameAr: subject.nameAr,
        coefficient: subject.coefficient,
        average,
        classAverage: classAverageBySubject.get(subject.id) ?? null,
        examCount: detail.parts.reduce(
          (count, p) => count + p.scores.filter((s) => s != null).length,
          0,
        ),
        detail,
      };
    });

    // Le bulletin officiel imprime la note coefficientée de chaque matière et
    // leur somme : la moyenne générale doit tomber juste à partir des nombres
    // imprimés. Le bulletin du Fondamental n'affiche pas ces colonnes et garde
    // la moyenne pondérée d'origine, au centième près.
    const general = generalAverage(results);
    const average =
      scheme === "SECONDARY"
        ? general.average == null
          ? null
          : roundHundredth(general.average)
        : weightedAverage(results);

    return {
      student,
      className: input.className,
      term: input.term,
      schoolLevel,
      scheme,
      formula,
      results,
      average,
      totalCoefficients: general.totalCoefficients,
      totalPoints: scheme === "SECONDARY" && average != null ? general.totalPoints : null,
      mention: mentionFor(average),
      attendance: input.attendance.get(student.id) ?? NO_ATTENDANCE,
    };
  });

  const allAverages = cards.map((c) => c.average).filter((a): a is number => a != null);
  return cards.map((card) => ({
    ...card,
    rank: rankOf(card.average, allAverages),
    classSize: students.length,
  }));
}

/** Note coefficientée d'une matière, telle qu'imprimée (Moy T × coefficient). */
export function weightedOf(result: ReportCardSubject): number | null {
  return result.average == null ? null : weightedScore(result.average, result.coefficient);
}

/** Libellé du bulletin récapitulatif de fin d'année. */
export const ANNUAL_TERM = "Année";

/**
 * La moyenne annuelle est calculée comme n'importe quelle moyenne : chaque
 * trimestre devient un « bloc » avec son poids, et la règle de l'école dit
 * par combien diviser. On réutilise donc le même moteur, et le bulletin
 * annuel s'imprime avec le même tableau, une colonne par trimestre.
 */
export function annualFormula(annual: AnnualFormula): Formula {
  return {
    parts: annual.terms.map((t) => ({
      id: t.term,
      label: t.term,
      kinds: [],
      weight: t.weight,
      multiple: "LAST" as const,
      // Un trimestre pas encore noté ne pénalise pas l'élève : il sort du
      // calcul, poids compris.
      required: false,
    })),
    divisor: annual.divisor,
  };
}

/**
 * Bulletin annuel d'une classe, à partir des bulletins de chaque trimestre
 * déjà calculés (dans l'ordre des trimestres de la règle).
 */
export function computeAnnualCards(
  termCards: { term: string; cards: ReportCard[] }[],
  annual: AnnualFormula,
): ReportCard[] {
  const formula = annualFormula(annual);
  const first = termCards[0]?.cards ?? [];
  if (first.length === 0) return [];

  const cards = first.map((base) => {
    // Absences et retards de l'année : ceux des trimestres, additionnés.
    const attendance = termCards.reduce(
      (total, { cards: list }) => {
        const card = list.find((c) => c.student.id === base.student.id);
        return card
          ? {
              present: total.present + card.attendance.present,
              absent: total.absent + card.attendance.absent,
              late: total.late + card.attendance.late,
            }
          : total;
      },
      { present: 0, absent: 0, late: 0 },
    );

    const results: ReportCardSubject[] = base.results.map((subject) => {
      const scoresByPart = annual.terms.map((t) => {
        const card = termCards
          .find((c) => c.term === t.term)
          ?.cards.find((c) => c.student.id === base.student.id);
        const line = card?.results.find((r) => r.subjectName === subject.subjectName);
        return [line?.average ?? null];
      });
      const computed = computeSubjectAverage(formula, scoresByPart);
      return {
        ...subject,
        average: computed.average,
        classAverage: null,
        examCount: scoresByPart.flat().filter((v) => v != null).length,
        detail: {
          parts: computed.parts,
          titles: annual.terms.map((t) => [t.term]),
          rank: null,
          observation: null,
        },
      };
    });

    const general = generalAverage(results);
    const average = general.average == null ? null : roundHundredth(general.average);
    return {
      ...base,
      term: ANNUAL_TERM,
      attendance,
      formula,
      results,
      average,
      totalCoefficients: general.totalCoefficients,
      totalPoints: average == null ? null : general.totalPoints,
      mention: mentionFor(average),
    };
  });

  // Rangs de l'année : par matière, puis au général.
  cards[0].results.forEach((_, index) => {
    const averages = cards
      .map((c) => c.results[index].average)
      .filter((a): a is number => a != null);
    for (const card of cards) {
      card.results[index].detail.rank = rankOf(card.results[index].average, averages);
      card.results[index].classAverage =
        averages.length > 0 ? averages.reduce((a, b) => a + b, 0) / averages.length : null;
    }
  });

  const allAverages = cards.map((c) => c.average).filter((a): a is number => a != null);
  return cards.map((card) => ({ ...card, rank: rankOf(card.average, allAverages) }));
}
