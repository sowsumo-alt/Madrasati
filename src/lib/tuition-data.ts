import { prisma } from "@/lib/prisma";
import { describePlan, isTuitionFrequency, monthsBetween, type TuitionFrequency } from "@/lib/tuition";
import { balanceOf } from "@/lib/money";
import { effectiveDueDate, payByDate } from "@/lib/due-rule";
import { loadDueRule } from "@/lib/due-rule-data";

/**
 * Lecture des formules de paiement : ce qu'affichent la fiche d'un élève et
 * le formulaire de la formule. L'écriture vit dans
 * app/directeur/finance/tuition-actions.ts.
 */

export interface TuitionSummary {
  frequency: TuitionFrequency;
  /** « Trimestriel (3 mois) », « 4 mois en une fois »… */
  description: string;
  monthlyAmount: number;
  /** Prochaine échéance non soldée de la formule ; null quand tout est réglé. */
  nextDue: { label: string; remaining: number; dueDate: string } | null;
}

/** Formule de chaque élève de l'école pour l'année en cours. */
export async function tuitionSummaries(schoolId: string): Promise<Map<string, TuitionSummary>> {
  const rule = await loadDueRule(schoolId);
  const plans = await prisma.tuitionPlan.findMany({
    where: { schoolId, academicYear: { isCurrent: true } },
    select: {
      studentId: true,
      frequency: true,
      periodMonths: true,
      monthlyAmount: true,
      fees: {
        orderBy: { dueDate: "asc" },
        select: { label: true, amount: true, dueDate: true, periodStart: true, payments: { select: { amount: true } } },
      },
    },
  });
  const result = new Map<string, TuitionSummary>();
  for (const plan of plans) {
    if (!isTuitionFrequency(plan.frequency)) continue;
    const next = plan.fees
      .map((f) => ({ ...f, remaining: f.amount - f.payments.reduce((s, p) => s + p.amount, 0) }))
      .find((f) => f.remaining > 0);
    result.set(plan.studentId, {
      frequency: plan.frequency,
      description: describePlan(plan.frequency, plan.periodMonths),
      monthlyAmount: plan.monthlyAmount,
      nextDue: next
        ? { label: next.label, remaining: next.remaining, dueDate: payByDate(next, rule).toISOString() }
        : null,
    });
  }
  return result;
}

export interface TuitionFormData {
  student: { id: string; name: string };
  yearLabel: string;
  /** Mois de l'année scolaire, ISO (premier jour du mois). */
  yearMonths: string[];
  /** Montant mensuel de l'école (Paramètres) ; null s'il n'est pas renseigné. */
  schoolMonthly: number | null;
  plan: {
    frequency: TuitionFrequency;
    periodMonths: number;
    monthlyAmount: number;
    firstMonth: string;
  } | null;
  /** Mois déjà couverts par une échéance réglée, même en partie : jamais refacturés. */
  paidMonths: string[];
}

export async function loadTuitionForm(schoolId: string, studentId: string): Promise<TuitionFormData | null> {
  const [student, year, school] = await Promise.all([
    prisma.student.findFirst({
      where: { id: studentId, schoolId },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true, label: true, startDate: true, endDate: true },
    }),
    prisma.school.findUnique({ where: { id: schoolId }, select: { monthlyTuition: true } }),
  ]);
  if (!student || !year) return null;

  const plan = await prisma.tuitionPlan.findUnique({
    where: { studentId_academicYearId: { studentId, academicYearId: year.id } },
    select: {
      frequency: true,
      periodMonths: true,
      monthlyAmount: true,
      firstMonth: true,
      fees: { where: { payments: { some: {} } }, select: { periodStart: true, periodEnd: true } },
    },
  });

  const paidMonths = (plan?.fees ?? []).flatMap((f) =>
    f.periodStart && f.periodEnd ? monthsBetween(f.periodStart, f.periodEnd).map((m) => m.toISOString()) : [],
  );

  return {
    student: { id: student.id, name: `${student.firstName} ${student.lastName}` },
    yearLabel: year.label,
    yearMonths: monthsBetween(year.startDate, year.endDate).map((m) => m.toISOString()),
    schoolMonthly: school?.monthlyTuition ?? null,
    plan:
      plan && isTuitionFrequency(plan.frequency)
        ? {
            frequency: plan.frequency,
            periodMonths: plan.periodMonths,
            monthlyAmount: plan.monthlyAmount,
            firstMonth: plan.firstMonth.toISOString(),
          }
        : null,
    paidMonths,
  };
}

/** Ce que les formulaires d'inscription proposent d'office pour la scolarité. */
export interface TuitionSettings {
  /** Montant d'un mois de l'école (Paramètres) ; null s'il n'est pas renseigné. */
  monthly: number | null;
  /** Le dernier mois de l'année est payé dès l'inscription (coché d'office). */
  prepayLastMonth: boolean;
  /** Mois de l'année scolaire en cours, ISO (premier jour du mois). */
  yearMonths: string[];
  /** « 2026-2027 » ; null sans année en cours. */
  yearLabel: string | null;
  /** Unité dans laquelle l'école écrit ses montants (en base : toujours MRU). */
  amountUnit: "MRU" | "MRO";
  /** Famille de plusieurs enfants : une fiche pour la famille, ou une par enfant. */
  familySheetMode: "FAMILY" | "PER_CHILD";
}

export async function loadTuitionSettings(schoolId: string): Promise<TuitionSettings> {
  const [school, year] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { monthlyTuition: true, prepayLastMonth: true, amountUnit: true, familySheetMode: true },
    }),
    prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
      select: { label: true, startDate: true, endDate: true },
    }),
  ]);
  return {
    monthly: school?.monthlyTuition ?? null,
    prepayLastMonth: school?.prepayLastMonth ?? false,
    yearMonths: year ? monthsBetween(year.startDate, year.endDate).map((m) => m.toISOString()) : [],
    yearLabel: year?.label ?? null,
    amountUnit: school?.amountUnit === "MRO" ? "MRO" : "MRU",
    familySheetMode: school?.familySheetMode === "PER_CHILD" ? "PER_CHILD" : "FAMILY",
  };
}

/** La part d'un élève : ce qui lui est facturé, versé et dû à ce jour (lib/money.ts). */
export interface StudentMoney {
  billed: number;
  paid: number;
  due: number;
  /** Forfait famille : ses frais sont ceux de la fiche familiale, portés par cet élève référent. */
  includedIn: string | null;
}

export async function studentMoneySummaries(schoolId: string): Promise<Map<string, StudentMoney>> {
  const [students, familyPlans, year, rule] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId },
      select: {
        id: true,
        fees: { select: { amount: true, dueDate: true, periodStart: true, academicYearId: true, payments: { select: { amount: true } } } },
        parentLinks: { select: { parentId: true } },
      },
    }),
    prisma.tuitionPlan.findMany({
      where: { schoolId, academicYear: { isCurrent: true }, familyParentId: { not: null } },
      select: { studentId: true, familyParentId: true, student: { select: { firstName: true, lastName: true } } },
    }),
    prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true } }),
    loadDueRule(schoolId),
  ]);
  const holderOf = new Map(familyPlans.map((p) => [p.familyParentId!, p]));
  const result = new Map<string, StudentMoney>();
  for (const s of students) {
    const balance = balanceOf(
      s.fees.map((f) => ({ amount: f.amount, paid: f.payments.reduce((sum, p) => sum + p.amount, 0), dueDate: effectiveDueDate(f, rule) })),
    );
    const plan = s.parentLinks.map((l) => holderOf.get(l.parentId)).find(Boolean);
    const included =
      plan && plan.studentId !== s.id && !s.fees.some((f) => f.academicYearId === year?.id)
        ? `${plan.student.firstName} ${plan.student.lastName}`.trim()
        : null;
    result.set(s.id, { billed: balance.billed, paid: balance.paid, due: balance.due, includedIn: included });
  }
  return result;
}
