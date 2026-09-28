import { prisma } from "@/lib/prisma";
import { describePlan, isTuitionFrequency, monthsBetween, type TuitionFrequency } from "@/lib/tuition";

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
  const plans = await prisma.tuitionPlan.findMany({
    where: { schoolId, academicYear: { isCurrent: true } },
    select: {
      studentId: true,
      frequency: true,
      periodMonths: true,
      monthlyAmount: true,
      fees: {
        orderBy: { dueDate: "asc" },
        select: { label: true, amount: true, dueDate: true, payments: { select: { amount: true } } },
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
        ? { label: next.label, remaining: next.remaining, dueDate: next.dueDate.toISOString() }
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
