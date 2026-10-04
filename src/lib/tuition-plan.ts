import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { UserError } from "@/lib/user-error";
import { generateReceiptNumber } from "@/lib/receipts";
import {
  TUITION_FREQUENCIES,
  addMonths,
  buildInstallments,
  coveredMonths,
  monthStart,
  prepaidShare,
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
    planId: plan.id,
    /** Premier mois facturé, ramené dans l'année scolaire. */
    firstMonth,
    created: installments.length,
    replaced: removed.count,
    first: installments[0] ? { label: installments[0].label, amount: installments[0].amount } : null,
  };
}

/**
 * Mois déjà réglés avant Madrasati : un élève inscrit depuis la rentrée dont
 * le parent a payé, par exemple, 4 mois d'avance. Ces mois ne doivent
 * apparaître ni « en attente » ni « impayés » : chaque échéance qui les
 * couvre reçoit le paiement correspondant (avec son reçu), entier ou partiel
 * — un trimestre dont un seul mois est réglé reste partiel.
 *
 * `through` : dernier mois réglé, inclus. Rien n'est jamais payé deux fois :
 * ce qu'une échéance a déjà reçu est déduit.
 */
export async function settlePrepaidMonths(
  tx: Prisma.TransactionClient,
  input: {
    schoolId: string;
    planId: string;
    through: Date;
    method: string;
    paidAt: Date;
    userId: string;
    attempt: number;
  },
): Promise<{ paymentIds: string[]; total: number }> {
  const through = monthStart(input.through);
  const plan = await tx.tuitionPlan.findUniqueOrThrow({
    where: { id: input.planId },
    select: {
      studentId: true,
      monthlyAmount: true,
      fees: {
        where: { periodStart: { lte: through } },
        orderBy: { periodStart: "asc" },
        select: {
          id: true,
          amount: true,
          periodStart: true,
          periodEnd: true,
          payments: { select: { amount: true } },
        },
      },
    },
  });

  const paymentIds: string[] = [];
  let total = 0;
  for (const fee of plan.fees) {
    if (!fee.periodStart || !fee.periodEnd) continue;
    const target = prepaidShare(
      { periodStart: fee.periodStart, periodEnd: fee.periodEnd, amount: fee.amount },
      through,
      plan.monthlyAmount,
    );
    const already = fee.payments.reduce((sum, p) => sum + p.amount, 0);
    const due = target - already;
    if (due <= 0) continue;
    const payment = await tx.payment.create({
      data: {
        schoolId: input.schoolId,
        feeId: fee.id,
        studentId: plan.studentId,
        amount: due,
        method: input.method,
        receiptNumber: await generateReceiptNumber(tx, input.schoolId, input.attempt),
        paidAt: input.paidAt,
        recordedByUserId: input.userId,
        note: "Déjà payé avant l'enregistrement dans Madrasati",
      },
    });
    const paid = already + due;
    await tx.fee.update({
      where: { id: fee.id },
      data: { status: paid >= fee.amount ? "PAID" : "PARTIAL" },
    });
    paymentIds.push(payment.id);
    total += due;
  }
  return { paymentIds, total };
}

/** Dernier mois réglé quand les `count` premiers mois de la formule sont payés. */
export function prepaidThrough(firstMonth: Date, count: number): Date | null {
  return count > 0 ? addMonths(monthStart(firstMonth), count - 1) : null;
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
    /** Mois déjà réglés avant Madrasati, à partir du premier mois facturé. */
    paidMonths: z.coerce.number().int().min(0).max(12).default(0),
  })
  .optional();
export type EnrollmentTuition = z.input<typeof enrollmentTuitionSchema>;

/** La formule à appliquer, ou null quand il n'y a rien à créer. */
export function enrollmentPlan(
  tuition: z.infer<typeof enrollmentTuitionSchema>,
): { frequency: TuitionFrequency; customMonths: number; monthlyAmount: number; paidMonths: number } | null {
  if (!tuition || tuition.frequency === "NONE") return null;
  const monthly = typeof tuition.monthly === "number" ? tuition.monthly : 0;
  if (monthly <= 0) return null;
  return {
    frequency: tuition.frequency,
    customMonths: tuition.customMonths,
    monthlyAmount: monthly,
    paidMonths: tuition.paidMonths ?? 0,
  };
}
