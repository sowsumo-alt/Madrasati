import { prisma } from "@/lib/prisma";
import { termDateRange } from "@/lib/report-card";
import { currentGradingConfig, gradingConfigById } from "@/lib/grading-config-data";
import type { GradingConfig } from "@/lib/grading-config";
import {
  ANNUAL_TERM,
  computeAnnualCards,
  computeReportCards,
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
    })),
    students,
    exams,
    attendance,
    config: config ?? current?.config,
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
 * Bulletin annuel d'une classe : les moyennes des trois trimestres,
 * combinées selon la règle de l'école (poids de chaque trimestre et
 * diviseur). N'existe que si l'école a activé le bulletin annuel.
 */
export async function buildAnnualReportCards(
  schoolId: string,
  classId: string,
  config?: GradingConfig,
): Promise<ReportCard[]> {
  const rule = config ?? (await currentGradingConfig(schoolId)).config;
  if (!rule.annual.enabled) return [];

  const terms = rule.annual.terms.map((t) => t.term);
  const cards = await Promise.all(
    terms.map(async (term) => ({
      term,
      cards: await buildReportCards(schoolId, classId, term, rule),
    })),
  );
  return computeAnnualCards(cards, rule.annual);
}

export { ANNUAL_TERM, TERM_LABELS };
