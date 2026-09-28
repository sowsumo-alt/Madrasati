"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { UserError, asResult } from "@/lib/user-error";
import { loadTuitionForm } from "@/lib/tuition-data";
import { TUITION_FREQUENCIES, monthStart, monthsBetween } from "@/lib/tuition";
import { applyTuitionPlan } from "@/lib/tuition-plan";

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

    const result = await prisma.$transaction(
      (tx) =>
        applyTuitionPlan(tx, {
          schoolId: user.schoolId,
          studentId: student.id,
          year,
          frequency: data.frequency,
          customMonths: data.customMonths,
          monthlyAmount: data.monthlyAmount,
          firstMonth,
        }),
      { timeout: 30_000 },
    );

    revalidatePath("/directeur/finance");
    revalidatePath("/directeur/eleves");
    revalidatePath("/directeur");
    return result;
  });
}
