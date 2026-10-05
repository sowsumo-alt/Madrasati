"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { UserError, asResult } from "@/lib/user-error";
import { loadTuitionForm } from "@/lib/tuition-data";
import { TUITION_FREQUENCIES, monthStart, monthsBetween } from "@/lib/tuition";
import { applyTuitionPlan, prepaidParts, recordGroupedPayment } from "@/lib/tuition-plan";
import { runWithReceipt } from "@/lib/receipts";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { ACTIVITY_ACTIONS, logActivity } from "@/lib/activity";

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
  /** Mois déjà réglés (ISO, premier jour du mois) : les premiers, juin… */
  paidMonths: z.array(z.string().min(1)).max(24).default([]),
  /** Mode de paiement de ces mois. */
  method: z.enum(PAYMENT_METHODS).default("CASH"),
});
export type TuitionPlanInput = z.input<typeof planSchema>;

/** Enregistre la formule de paiement d'un élève et (re)crée ses échéances (voir applyTuitionPlan). */
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

    const firstMonth = monthStart(new Date(data.firstMonth));
    if (!monthsBetween(year.startDate, year.endDate).some((m) => m.getTime() === firstMonth.getTime())) {
      throw new UserError("Choisissez un mois de l'année scolaire.");
    }

    // Seuls les mois facturés par la formule comptent.
    const paidMonths = data.paidMonths
      .map((m) => monthStart(new Date(m)))
      .filter((m) => !Number.isNaN(m.getTime()) && m >= firstMonth);

    const result = await runWithReceipt(async (tx, attempt) => {
      const applied = await applyTuitionPlan(tx, {
        schoolId: user.schoolId,
        studentId: student.id,
        year,
        frequency: data.frequency,
        customMonths: data.customMonths,
        monthlyAmount: data.monthlyAmount,
        firstMonth,
      });
      const named = await tx.student.findUnique({ where: { id: student.id }, select: { firstName: true, lastName: true } });
      await logActivity(tx, {
        schoolId: user.schoolId,
        userId: user.id,
        action: ACTIVITY_ACTIONS.SHEET,
        summary: `Formule de paiement modifiée — ${named?.firstName ?? ""} ${named?.lastName ?? ""}`.trim(),
        amount: data.monthlyAmount,
      });
      // Les mois que le parent avait déjà réglés : payés, pas « impayés »,
      // sur un seul reçu.
      const parts = await prepaidParts(tx, applied.planId, paidMonths);
      await recordGroupedPayment(tx, {
        schoolId: user.schoolId,
        parts,
        method: data.method,
        userId: user.id,
        attempt,
        note: "Déjà payé avant l'enregistrement dans Madrasati",
      });
      return { ...applied, prepaid: parts.length, prepaidTotal: parts.reduce((sum, p) => sum + p.amount, 0) };
    });

    revalidatePath("/directeur/finance");
    revalidatePath("/directeur/eleves");
    revalidatePath("/directeur");
    return result;
  });
}
