"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { UserError, asResult } from "@/lib/user-error";
import { generateReceiptNumber, runWithReceipt } from "@/lib/receipts";
import { cancelReceipt } from "@/lib/payment-cancel";
import { ACTIVITY_ACTIONS, logActivity } from "@/lib/activity";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { formatMRU } from "@/lib/format";

const schema = z.object({
  paymentId: z.string().min(1),
  /** Le bon montant, en MRU. */
  amount: z.coerce.number().int().positive("Le montant doit être supérieur à 0.").max(100_000_000),
  method: z.enum(PAYMENT_METHODS),
  /** Jour du versement « AAAA-MM-JJ ». */
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  reason: z.string().trim().min(3, "Indiquez le motif de la correction.").max(300),
  submissionKey: z.string().max(64).optional(),
});

/**
 * Corriger un paiement mal saisi (montant, mode ou date) sans rien supprimer :
 * l'ancien reçu est annulé avec le motif « corrigé par REC-… » et reste
 * lisible, marqué ANNULÉ ; un nouveau reçu porte le bon montant. L'argent
 * perçu suit aussitôt, et le journal garde les deux numéros.
 *
 * Un reçu qui couvre plusieurs mois ou plusieurs enfants (reçu groupé) se
 * corrige en l'annulant puis en ré-encaissant : ses parts ont été réparties
 * ensemble.
 */
export async function correctPaymentAction(input: z.input<typeof schema>) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Saisie invalide.");
    const data = parsed.data;

    const result = await runWithReceipt(
      user.schoolId,
      async (tx, attempt) => {
        const old = await tx.payment.findFirst({
          where: { id: data.paymentId, schoolId: user.schoolId },
          include: { fee: { select: { id: true, amount: true, label: true } } },
        });
        if (!old) throw new UserError("Paiement introuvable, ou déjà annulé.");
        if (old.familyPaymentId) {
          throw new UserError(
            "Ce reçu couvre plusieurs mois ou plusieurs enfants : annulez-le, puis enregistrez de nouveau le bon montant.",
          );
        }

        // Ce qui resterait à payer sans ce paiement : le bon montant ne peut pas le dépasser.
        const others = await tx.payment.aggregate({
          where: { feeId: old.feeId, id: { not: old.id } },
          _sum: { amount: true },
        });
        const left = old.fee.amount - (others._sum.amount ?? 0);
        if (data.amount > left) {
          throw new UserError(`Le montant dépasse ce qui reste à payer pour ce frais (${formatMRU(Math.max(left, 0))}).`);
        }
        const unchanged =
          data.amount === old.amount && data.method === old.method && data.paidOn === old.paidAt.toISOString().slice(0, 10);
        if (unchanged) throw new UserError("Rien n'a changé : modifiez le montant, le mode ou la date.");

        const receiptNumber = await generateReceiptNumber(tx, user.schoolId, attempt);
        await cancelReceipt(tx, {
          schoolId: user.schoolId,
          userId: user.id,
          reason: `Corrigé par le reçu ${receiptNumber} — ${data.reason}`,
          target: { paymentId: old.id },
        });

        // Même heure qu'avant si seul le jour change : l'ordre des reçus du jour est gardé.
        const paidAt = new Date(`${data.paidOn}T${old.paidAt.toISOString().slice(11)}`);
        const payment = await tx.payment.create({
          data: {
            schoolId: user.schoolId,
            feeId: old.feeId,
            studentId: old.studentId,
            amount: data.amount,
            method: data.method,
            note: `Remplace le reçu ${old.receiptNumber}${old.note ? ` — ${old.note}` : ""}`,
            receiptNumber,
            paidAt,
            recordedByUserId: user.id,
          },
        });
        const paid = (await tx.payment.aggregate({ where: { feeId: old.feeId }, _sum: { amount: true } }))._sum.amount ?? 0;
        await tx.fee.update({
          where: { id: old.feeId },
          data: { status: paid >= old.fee.amount ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING" },
        });

        await logActivity(tx, {
          schoolId: user.schoolId,
          userId: user.id,
          action: ACTIVITY_ACTIONS.PAYMENT,
          summary: `Paiement corrigé : reçu ${old.receiptNumber} (${formatMRU(old.amount)}) remplacé par ${receiptNumber} (${formatMRU(data.amount)}) — ${old.fee.label} — motif : ${data.reason}`,
          amount: data.amount,
          href: `/directeur/finance/recus/${payment.id}`,
        });
        return { paymentId: payment.id, receiptNumber };
      },
      { submissionKey: data.submissionKey },
    );

    revalidatePath("/directeur/finance");
    revalidatePath("/directeur/familles", "layout");
    revalidatePath("/directeur");
    return result;
  });
}
