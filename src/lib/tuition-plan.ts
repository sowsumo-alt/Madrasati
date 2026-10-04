import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { UserError } from "@/lib/user-error";
import { familyPartReceiptNumber, generateReceiptNumber } from "@/lib/receipts";
import {
  TUITION_FREQUENCIES,
  buildInstallments,
  coveredMonths,
  monthStart,
  prepaidShare,
  monthKeys,
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

/** Une part d'un versement : ce qu'il apporte à un frais. */
export interface PaymentPart {
  feeId: string;
  studentId: string;
  amount: number;
  /** Montant du frais et ce qu'il avait déjà reçu : pour son nouveau statut. */
  feeAmount: number;
  paidBefore: number;
}

/**
 * Les parts à régler pour que les mois choisis d'une formule soient payés :
 * les premiers mois (élève inscrit avant Madrasati), ou le dernier — juin,
 * que beaucoup d'écoles font payer dès l'inscription. Chaque échéance qui
 * couvre ces mois reçoit sa part, entière ou partielle (un trimestre dont un
 * seul mois est réglé reste partiel). Ce qu'une échéance a déjà reçu est
 * déduit : rien n'est payé deux fois.
 */
export async function prepaidParts(
  tx: Prisma.TransactionClient,
  planId: string,
  months: Date[],
): Promise<PaymentPart[]> {
  const keys = monthKeys(months);
  if (keys.size === 0) return [];
  const plan = await tx.tuitionPlan.findUniqueOrThrow({
    where: { id: planId },
    select: {
      studentId: true,
      monthlyAmount: true,
      fees: {
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

  const parts: PaymentPart[] = [];
  for (const fee of plan.fees) {
    if (!fee.periodStart || !fee.periodEnd) continue;
    const target = prepaidShare(
      { periodStart: fee.periodStart, periodEnd: fee.periodEnd, amount: fee.amount },
      keys,
      plan.monthlyAmount,
    );
    const already = fee.payments.reduce((sum, p) => sum + p.amount, 0);
    if (target - already <= 0) continue;
    parts.push({
      feeId: fee.id,
      studentId: plan.studentId,
      amount: target - already,
      feeAmount: fee.amount,
      paidBefore: already,
    });
  }
  return parts;
}

/**
 * Un versement, sur un ou plusieurs frais, avec un seul reçu : l'inscription
 * et le mois de juin payés ensemble, quatre mois d'un coup, ou les frais de
 * plusieurs enfants d'une même famille. Plusieurs parts : un reçu groupé
 * (REC-2026-0012) dont chaque part porte le numéro suivi de son rang
 * (REC-2026-0012-1, -2…). Une seule part : un reçu ordinaire, sauf
 * `forceGroup` (le reçu « famille » de l'inscription groupée).
 *
 * Renvoie le premier paiement — sa page de reçu mène au reçu groupé — et le
 * reçu groupé s'il y en a un.
 */
export async function recordGroupedPayment(
  tx: Prisma.TransactionClient,
  input: {
    schoolId: string;
    parts: PaymentPart[];
    method: string;
    userId: string;
    attempt: number;
    paidAt?: Date;
    note?: string | null;
    /** Parent du reçu groupé ; non précisé : le parent principal du premier élève. */
    parentId?: string | null;
    forceGroup?: boolean;
  },
): Promise<{ firstPaymentId: string | null; groupId: string | null }> {
  const parts = input.parts.filter((p) => p.amount > 0);
  if (parts.length === 0) return { firstPaymentId: null, groupId: null };
  const paidAt = input.paidAt ?? new Date();
  const receiptNumber = await generateReceiptNumber(tx, input.schoolId, input.attempt);

  let groupId: string | null = null;
  if (parts.length > 1 || input.forceGroup) {
    const parentId =
      input.parentId !== undefined
        ? input.parentId
        : ((
            await tx.studentParent.findFirst({
              where: { studentId: parts[0].studentId, isPrimary: true },
              select: { parentId: true },
            })
          )?.parentId ?? null);
    groupId = (
      await tx.familyPayment.create({
        data: {
          schoolId: input.schoolId,
          parentId,
          receiptNumber,
          total: parts.reduce((sum, p) => sum + p.amount, 0),
          method: input.method,
          paidAt,
          note: input.note || null,
          recordedByUserId: input.userId,
        },
      })
    ).id;
  }

  let firstPaymentId: string | null = null;
  for (const [index, part] of parts.entries()) {
    const payment = await tx.payment.create({
      data: {
        schoolId: input.schoolId,
        feeId: part.feeId,
        studentId: part.studentId,
        amount: part.amount,
        method: input.method,
        note: input.note || null,
        receiptNumber: groupId ? familyPartReceiptNumber(receiptNumber, index + 1) : receiptNumber,
        familyPaymentId: groupId,
        paidAt,
        recordedByUserId: input.userId,
      },
    });
    firstPaymentId ??= payment.id;
    const paid = part.paidBefore + part.amount;
    await tx.fee.update({
      where: { id: part.feeId },
      data: { status: paid >= part.feeAmount ? "PAID" : "PARTIAL" },
    });
  }
  return { firstPaymentId, groupId };
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
    /** Mois payés dès l'inscription (ISO, premier jour du mois) : juin, ou les premiers mois. */
    paidMonths: z.array(z.string().min(1)).max(24).default([]),
  })
  .optional();
export type EnrollmentTuition = z.input<typeof enrollmentTuitionSchema>;

/** La formule à appliquer, ou null quand il n'y a rien à créer. */
export function enrollmentPlan(
  tuition: z.infer<typeof enrollmentTuitionSchema>,
): { frequency: TuitionFrequency; customMonths: number; monthlyAmount: number; paidMonths: Date[] } | null {
  if (!tuition || tuition.frequency === "NONE") return null;
  const monthly = typeof tuition.monthly === "number" ? tuition.monthly : 0;
  if (monthly <= 0) return null;
  return {
    frequency: tuition.frequency,
    customMonths: tuition.customMonths,
    monthlyAmount: monthly,
    paidMonths: (tuition.paidMonths ?? [])
      .map((m) => new Date(m))
      .filter((d) => !Number.isNaN(d.getTime()))
      .map(monthStart),
  };
}
