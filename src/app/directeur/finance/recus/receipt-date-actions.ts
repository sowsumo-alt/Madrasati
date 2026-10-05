"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { UserError, asResult } from "@/lib/user-error";
import { todayIso } from "@/lib/family-sheet";
import { ACTIVITY_ACTIONS, logActivity } from "@/lib/activity";

const schema = z.object({
  paymentId: z.string().min(1).optional(),
  familyPaymentId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
});

const shortDate = (iso: string) => iso.split("-").reverse().join("/");

/** Change la date d'un reçu (et de ses parts) ; renvoie de quoi le noter au journal. */
async function moveReceipt(
  tx: Prisma.TransactionClient,
  schoolId: string,
  data: z.infer<typeof schema>,
  paidAt: Date,
): Promise<{ number: string; before: Date; href: string }> {
  if (data.familyPaymentId) {
    const fp = await tx.familyPayment.findFirst({
      where: { id: data.familyPaymentId, schoolId, cancelledAt: null },
      select: { id: true, receiptNumber: true, paidAt: true },
    });
    if (!fp) throw new UserError("Reçu introuvable.");
    await tx.familyPayment.update({ where: { id: fp.id }, data: { paidAt } });
    await tx.payment.updateMany({ where: { familyPaymentId: fp.id }, data: { paidAt } });
    return { number: fp.receiptNumber, before: fp.paidAt, href: `/directeur/finance/recus/famille/${fp.id}` };
  }
  if (!data.paymentId) throw new UserError("Reçu introuvable.");
  const payment = await tx.payment.findFirst({
    where: { id: data.paymentId, schoolId },
    select: { id: true, receiptNumber: true, paidAt: true, familyPaymentId: true },
  });
  if (!payment || payment.familyPaymentId) throw new UserError("Reçu introuvable.");
  await tx.payment.update({ where: { id: payment.id }, data: { paidAt } });
  return { number: payment.receiptNumber, before: payment.paidAt, href: `/directeur/finance/recus/${payment.id}` };
}

/**
 * Corrige la date de paiement d'un reçu : celle écrite sur la fiche papier,
 * pas le jour de la saisie. Le reçu, l'argent perçu du jour et le reste dû
 * suivent cette date. Une date à venir est refusée ; la correction est
 * notée au journal d'activité.
 */
export async function changeReceiptDate(input: z.input<typeof schema>) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    const data = schema.parse(input);
    if (data.date > todayIso()) throw new UserError(`La date ${shortDate(data.date)} n'est pas encore arrivée.`);
    const paidAt = new Date(`${data.date}T12:00:00Z`);

    await prisma.$transaction(async (tx) => {
      const result = await moveReceipt(tx, user.schoolId, data, paidAt);
      await logActivity(tx, {
        schoolId: user.schoolId,
        userId: user.id,
        action: ACTIVITY_ACTIONS.PAYMENT,
        summary: `Date du reçu ${result.number} corrigée : ${shortDate(result.before.toISOString().slice(0, 10))} → ${shortDate(data.date)}`,
        href: result.href,
      });
    });

    revalidatePath("/directeur/finance", "layout");
    revalidatePath("/directeur/familles", "layout");
    revalidatePath("/directeur");
    return {};
  });
}
