import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { UserError } from "@/lib/user-error";
import {
  TUITION_FREQUENCIES,
  buildInstallments,
  coveredMonths,
  monthStart,
  monthsBetween,
  periodMonthsOf,
  type TuitionFrequency,
} from "@/lib/tuition";

/**
 * Enregistre la formule de paiement d'un élève et (re)crée ses échéances,
 * dans la transaction de l'appelant : fiche de l'élève, inscription d'un
 * élève, inscription d'une famille.
 *
 * Changer d'avis en cours d'année ne recommence rien : les échéances déjà
 * réglées — même en partie — restent telles quelles avec leurs reçus, et
 * leurs mois ne sont jamais refacturés. Seules les échéances encore sans
 * paiement, à partir du mois choisi, sont remplacées.
 */
export async function applyTuitionPlan(
  tx: Prisma.TransactionClient,
  input: {
    schoolId: string;
    studentId: string;
    year: { id: string; label: string; startDate: Date; endDate: Date };
    frequency: TuitionFrequency;
    /** Nombre de mois pour la formule « Personnalisé ». */
    customMonths: number;
    monthlyAmount: number;
    /** Premier mois facturé ; ramené dans l'année scolaire. */
    firstMonth: Date;
  },
) {
  const { schoolId, studentId, year, frequency, customMonths, monthlyAmount } = input;
  const yearMonths = monthsBetween(year.startDate, year.endDate);
  if (yearMonths.length === 0) throw new UserError("L'année scolaire n'a aucun mois.");
  const first = monthStart(input.firstMonth);
  const lastMonth = yearMonths[yearMonths.length - 1];
  // Un mois hors de l'année (inscription avant la rentrée, après juin) est
  // ramené au mois de l'année le plus proche.
  const firstMonth =
    first < yearMonths[0] ? yearMonths[0] : first > lastMonth ? lastMonth : first;
  const billed = monthsBetween(firstMonth, lastMonth);
  const periodMonths = periodMonthsOf(frequency, customMonths, billed.length);

  const plan = await tx.tuitionPlan.upsert({
    where: { studentId_academicYearId: { studentId, academicYearId: year.id } },
    create: {
      schoolId,
      studentId,
      academicYearId: year.id,
      frequency,
      periodMonths,
      monthlyAmount,
      firstMonth,
      lastMonth,
    },
    update: { frequency, periodMonths, monthlyAmount, firstMonth, lastMonth },
    select: { id: true },
  });

  const removed = await tx.fee.deleteMany({
    where: { tuitionPlanId: plan.id, periodStart: { gte: firstMonth }, payments: { none: {} } },
  });
  const kept = await tx.fee.findMany({
    where: { tuitionPlanId: plan.id },
    select: { periodStart: true, periodEnd: true },
  });
  const covered = coveredMonths(kept);
  const installments = buildInstallments({
    months: billed.filter((m) => !covered.has(m.getTime())),
    periodMonths,
    monthlyAmount,
    frequency,
    yearFirstMonth: yearMonths[0],
    yearLabel: year.label,
  });
  if (installments.length > 0) {
    await tx.fee.createMany({
      data: installments.map((i) => ({
        schoolId,
        studentId,
        academicYearId: year.id,
        tuitionPlanId: plan.id,
        label: i.label,
        amount: i.amount,
        dueDate: i.dueDate,
        periodStart: i.periodStart,
        periodEnd: i.periodEnd,
        status: "PENDING",
      })),
    });
  }
  return {
    created: installments.length,
    replaced: removed.count,
    first: installments[0] ? { label: installments[0].label, amount: installments[0].amount } : null,
  };
}

/**
 * Formule choisie à l'inscription (élève seul ou famille). « NONE », ou un
 * montant vide : rien n'est créé, la formule se choisira plus tard depuis la
 * fiche de l'élève.
 */
export const enrollmentTuitionSchema = z
  .object({
    frequency: z.enum([...TUITION_FREQUENCIES, "NONE"]),
    customMonths: z.coerce.number().int().min(1).max(12),
    monthly: z.union([z.literal(""), z.coerce.number().int().nonnegative().max(10_000_000)]),
  })
  .optional();
export type EnrollmentTuition = z.infer<typeof enrollmentTuitionSchema>;

/** La formule à appliquer, ou null quand il n'y a rien à créer. */
export function enrollmentPlan(
  tuition: EnrollmentTuition,
): { frequency: TuitionFrequency; customMonths: number; monthlyAmount: number } | null {
  if (!tuition || tuition.frequency === "NONE") return null;
  const monthly = typeof tuition.monthly === "number" ? tuition.monthly : 0;
  if (monthly <= 0) return null;
  return { frequency: tuition.frequency, customMonths: tuition.customMonths, monthlyAmount: monthly };
}
