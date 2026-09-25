import { prisma } from "@/lib/prisma";
import { termDateRange } from "@/lib/report-card";
import { currentGradingConfig, gradingConfigById } from "@/lib/grading-config-data";
import type { GradingConfig } from "@/lib/grading-config";
import {
  ANNUAL_TERM,
  computeReportCards,
  examKindOf,
  type ReportCard,
  type ReportCardAttendance,
} from "@/lib/report-card-compute";
import { TERM_LABELS } from "@/lib/grading-config";

export type { ReportCard } from "@/lib/report-card-compute";

/**
 * Construit les bulletins de tous les élèves d'une classe pour un trimestre.
 * Les moyennes par matière sont ramenées sur 20 pour rester comparables même
 * si les examens ont des notes maximales différentes.
 *
 * La formule appliquée est celle que l'école a configurée (Paramètres →
 * calcul des moyennes), avec une règle pour le collège et le lycée et une
 * autre pour le Fondamental : voir lib/report-card-compute.ts.
 *
 * `config` permet de recalculer un bulletin avec la règle d'une autre
 * version — celle avec laquelle il a été remis au parent.
 */
export async function buildReportCards(
  schoolId: string,
  classId: string,
  term: string,
  config?: GradingConfig,
): Promise<ReportCard[]> {
  // Le bulletin annuel prend les examens des trois trimestres.
  const annual = term === ANNUAL_TERM;
  const [classRoom, students, exams, academicYear, current] = await Promise.all([
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
      where: annual ? { schoolId, classId } : { schoolId, classId, term },
      select: {
        subjectId: true,
        term: true,
        title: true,
        kind: true,
        date: true,
        maxScore: true,
        grades: { select: { studentId: true, score: true, isAbsent: true, comment: true } },
      },
    }),
    prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } }),
    config ? Promise.resolve(null) : currentGradingConfig(schoolId),
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
      active: cs.subject.isActive,
    })),
    students,
    exams,
    attendance,
    config: config ?? current?.config,
    annual,
  });
}

/**
 * Règle de calcul à appliquer au bulletin d'un élève : celle avec laquelle il
 * a déjà été remis au parent s'il l'a été, sinon celle en vigueur.
 *
 * C'est ce qui empêche un changement de configuration de réécrire des
 * documents déjà distribués.
 */
export async function reportCardRule(options: {
  schoolId: string;
  studentId: string;
  academicYearId: string | null;
  term: string;
}) {
  const { schoolId, studentId, academicYearId, term } = options;
  const issue = academicYearId
    ? await prisma.reportCardIssue.findUnique({
        where: { studentId_academicYearId_term: { studentId, academicYearId, term } },
        select: { issuedAt: true, gradingConfigId: true },
      })
    : null;

  const pinned = issue?.gradingConfigId
    ? await gradingConfigById(schoolId, issue.gradingConfigId)
    : null;
  const current = await currentGradingConfig(schoolId);

  return {
    /** La règle à utiliser pour ce bulletin. */
    config: pinned?.config ?? current.config,
    current,
    issuedAt: issue?.issuedAt ?? null,
    /** Vrai quand le bulletin suit une règle plus ancienne que l'actuelle. */
    outdated: Boolean(pinned && pinned.id !== current.id),
  };
}

/**
 * Bulletin annuel d'une classe, calculé directement sur les notes des trois
 * trimestres avec la formule annuelle de l'école — par défaut : meilleur
 * devoir de l'année × 3 + compositions T1 × 1, T2 × 2, T3 × 3, ÷ 9. Rien
 * n'est ressaisi : ce sont les notes déjà enregistrées pour les bulletins
 * trimestriels. Vide si l'école n'a pas de bulletin annuel.
 */
export async function buildAnnualReportCards(
  schoolId: string,
  classId: string,
  config?: GradingConfig,
): Promise<ReportCard[]> {
  const rule = config ?? (await currentGradingConfig(schoolId)).config;
  if (!rule.annual.enabled) return [];
  return buildReportCards(schoolId, classId, ANNUAL_TERM, rule);
}

/**
 * Le bulletin annuel ne s'établit qu'une fois l'année finie : quand chacun
 * des trois trimestres a une composition notée dans la classe. Renvoie les
 * trimestres qui en manquent encore.
 */
export async function annualMissingTerms(schoolId: string, classId: string): Promise<string[]> {
  const exams = await prisma.exam.findMany({
    where: { schoolId, classId, grades: { some: { OR: [{ score: { not: null } }, { isAbsent: true }] } } },
    select: { term: true, kind: true, title: true },
  });
  const done = new Set(
    exams.filter((e) => examKindOf(e) === "COMPOSITION").map((e) => e.term),
  );
  return TERM_LABELS.filter((term) => !done.has(term));
}

export interface TermRecap {
  term: string;
  average: number | null;
  rank: number | null;
  classSize: number;
}

/**
 * Moyennes générales d'un élève à chaque trimestre, reprises des bulletins
 * trimestriels — avec la règle de calcul de chacun d'eux s'il a déjà été
 * remis — pour montrer son évolution sur le bulletin annuel.
 */
export async function termRecap(options: {
  schoolId: string;
  classId: string;
  studentId: string;
  academicYearId: string | null;
}): Promise<TermRecap[]> {
  const { schoolId, classId, studentId, academicYearId } = options;
  return Promise.all(
    TERM_LABELS.map(async (term) => {
      const rule = await reportCardRule({ schoolId, studentId, academicYearId, term });
      const cards = await buildReportCards(schoolId, classId, term, rule.config);
      const card = cards.find((c) => c.student.id === studentId);
      return {
        term,
        average: card?.average ?? null,
        rank: card?.average != null ? card.rank : null,
        classSize: card?.classSize ?? cards.length,
      };
    }),
  );
}

export { ANNUAL_TERM, TERM_LABELS };

/**
 * Bulletins de toute une classe pour un trimestre, chacun avec sa règle de
 * calcul : celle du jour où il a été remis au parent s'il l'a été, sinon la
 * règle actuelle. Renvoyés dans l'ordre alphabétique de la classe.
 *
 * Un calcul par règle distincte, pas par élève : d'ordinaire toute la classe
 * suit la même, et tout se fait en un passage.
 */
export async function classCardsWithRules(
  schoolId: string,
  classId: string,
  term: string,
): Promise<ReportCard[]> {
  const classRoom = await prisma.classRoom.findFirst({
    where: { id: classId, schoolId },
    select: { academicYearId: true },
  });
  if (!classRoom) return [];

  const [current, issues] = await Promise.all([
    currentGradingConfig(schoolId),
    prisma.reportCardIssue.findMany({
      where: { schoolId, academicYearId: classRoom.academicYearId, term, student: { classId } },
      select: { studentId: true, gradingConfigId: true },
    }),
  ]);

  const cards = await buildReportCards(schoolId, classId, term, current.config);
  const pinnedIds = [
    ...new Set(
      issues
        .map((i) => i.gradingConfigId)
        .filter((id): id is string => id != null && id !== current.id),
    ),
  ];
  if (pinnedIds.length === 0) return cards;

  const byStudent = new Map(cards.map((c) => [c.student.id, c]));
  for (const configId of pinnedIds) {
    const pinned = await gradingConfigById(schoolId, configId);
    if (!pinned) continue;
    const pinnedCards = await buildReportCards(schoolId, classId, term, pinned.config);
    for (const issue of issues.filter((i) => i.gradingConfigId === configId)) {
      const card = pinnedCards.find((c) => c.student.id === issue.studentId);
      if (card) byStudent.set(issue.studentId, card);
    }
  }
  return cards.map((c) => byStudent.get(c.student.id) ?? c);
}
