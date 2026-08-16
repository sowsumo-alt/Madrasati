"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/super-admin-session";
import { isPlan, isSubscriptionStatus } from "@/lib/plans";

/** Change la formule d'une école — n'active jamais rien de plus : c'est le
 *  statut d'abonnement (voir changeSubscriptionStatus/markAsPaid) qui décide
 *  si cette formule est effectivement accordée (voir effectivePlan). */
export async function changeSchoolPlan(schoolId: string, plan: string) {
  await requireSuperAdmin();
  if (!isPlan(plan)) throw new Error("Formule invalide.");

  await prisma.school.update({ where: { id: schoolId }, data: { plan } });
  revalidatePath("/super-admin");
}

export async function changeSubscriptionStatus(schoolId: string, status: string) {
  await requireSuperAdmin();
  if (!isSubscriptionStatus(status)) throw new Error("Statut invalide.");

  await prisma.school.update({ where: { id: schoolId }, data: { subscriptionStatus: status } });
  revalidatePath("/super-admin");
}

const markPaidSchema = z.object({
  amount: z.coerce.number().int().positive("Le montant doit être positif"),
  note: z.string().trim().optional().or(z.literal("")),
});
export type MarkPaidValues = z.infer<typeof markPaidSchema>;

/** Enregistre un paiement reçu et réactive l'école (restreinte ou suspendue)
 *  automatiquement — la prochaine échéance est fixée à 30 jours. */
export async function markAsPaid(schoolId: string, values: MarkPaidValues) {
  await requireSuperAdmin();
  const data = markPaidSchema.parse(values);

  const now = new Date();
  const nextDue = new Date(now);
  nextDue.setDate(nextDue.getDate() + 30);

  await prisma.$transaction([
    prisma.subscriptionPayment.create({
      data: { schoolId, amount: data.amount, note: data.note || null, paidAt: now },
    }),
    prisma.school.update({
      where: { id: schoolId },
      data: { lastPaymentAt: now, nextDueAt: nextDue, subscriptionStatus: "active" },
    }),
  ]);

  revalidatePath("/super-admin");
}

export interface SubscriptionPaymentRow {
  id: string;
  amount: number;
  paidAt: string;
  note: string | null;
}

export async function getPaymentHistory(schoolId: string): Promise<SubscriptionPaymentRow[]> {
  await requireSuperAdmin();

  const payments = await prisma.subscriptionPayment.findMany({
    where: { schoolId },
    orderBy: { paidAt: "desc" },
  });

  return payments.map((p) => ({
    id: p.id,
    amount: p.amount,
    paidAt: p.paidAt.toISOString(),
    note: p.note,
  }));
}
