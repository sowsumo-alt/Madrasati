"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { UserError, asResult } from "@/lib/user-error";
import { loadTuitionForm } from "@/lib/tuition-data";
import {
  TUITION_FREQUENCIES,
  buildInstallments,
  coveredMonths,
  monthStart,
  monthsBetween,
  periodMonthsOf,
} from "@/lib/tuition";

/** Données du formulaire « Formule de paiement » d'un élève. */
export async function tuitionForm(studentId: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  return loadTuitionForm(user.schoolId, studentId);
}

const planSchema = z.object({
  studentId: z.string().min(1),
  frequency: z.enum(TUITION_FREQUENCIES),
  /** Nombre de mois pour la formule « Personnalisé ». */
  customMonths: z.coerce.number().int().min(1).max(12),
  monthlyAmount: z.coerce.number().int().positive("Indiquez le montant d'un mois").max(10_000_000),
  /** Premier mois facturé, ISO. */
  firstMonth: z.string().min(1),
});
export type TuitionPlanInput = z.infer<typeof planSchema>;

/**
 * Enregistre la formule de paiement d'un élève et (re)crée ses échéances.
 *
 * Changer d'avis en cours d'année ne recommence rien : les échéances déjà
 * réglées — même en partie — restent telles quelles avec leurs reçus, et
 * leurs mois ne sont jamais refacturés. Seules les échéances encore sans
 * paiement, à partir du mois choisi, sont remplacées par celles de la
 * nouvelle formule.
 */
export async function saveTuitionPlan(input: TuitionPlanInput) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    const data = planSchema.parse(input);

    const [student, year] = await Promise.all([
      prisma.student.findFirst({ where: { id: data.studentId, schoolId: user.schoolId }, select: { id: true } }),
      prisma.academicYear.findFirst({
        where: { schoolId: user.schoolId, isCurrent: true },
        select: { id: true, label: true, startDate: true, endDate: true },
      }),
    ]);
    if (!student) throw new UserError("Élève introuvable.");
    if (!year) throw new UserError("Aucune année scolaire active.");

    const yearMonths = monthsBetween(year.startDate, year.endDate);
    const firstMonth = monthStart(new Date(data.firstMonth));
    const lastMonth = yearMonths[yearMonths.length - 1];
    if (!yearMonths.some((m) => m.getTime() === firstMonth.getTime())) {
      throw new UserError("Choisissez un mois de l'année scolaire.");
    }
    const billed = monthsBetween(firstMonth, lastMonth);
    const periodMonths = periodMonthsOf(data.frequency, data.customMonths, billed.length);

    const result = await prisma.$transaction(
      async (tx) => {
        const plan = await tx.tuitionPlan.upsert({
          where: { studentId_academicYearId: { studentId: student.id, academicYearId: year.id } },
          create: {
            schoolId: user.schoolId,
            studentId: student.id,
            academicYearId: year.id,
            frequency: data.frequency,
            periodMonths,
            monthlyAmount: data.monthlyAmount,
            firstMonth,
            lastMonth,
          },
          update: { frequency: data.frequency, periodMonths, monthlyAmount: data.monthlyAmount, firstMonth, lastMonth },
          select: { id: true },
        });

        // Les échéances encore sans paiement, à partir du mois choisi, sont
        // remplacées ; les autres (payées, ou plus anciennes) restent.
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
          monthlyAmount: data.monthlyAmount,
          frequency: data.frequency,
          yearFirstMonth: yearMonths[0],
          yearLabel: year.label,
        });
        if (installments.length > 0) {
          await tx.fee.createMany({
            data: installments.map((i) => ({
              schoolId: user.schoolId,
              studentId: student.id,
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
      },
      { timeout: 30_000 },
    );

    revalidatePath("/directeur/finance");
    revalidatePath("/directeur/eleves");
    revalidatePath("/directeur");
    return result;
  });
}
