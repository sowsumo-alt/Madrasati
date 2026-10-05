import type { Prisma } from "@prisma/client";
import { UserError } from "@/lib/user-error";
import { ACTIVITY_ACTIONS, logActivity } from "@/lib/activity";

/**
 * Annulation d'un reçu — jamais un effacement silencieux.
 *
 * Chaque paiement annulé est recopié dans CancelledPayment (montant, élève,
 * frais, numéro de reçu, et qui l'annule, quand, pourquoi), puis retiré des
 * paiements : l'argent perçu baisse d'autant, et l'échéance retrouve son état
 * d'avant le paiement. Le reçu reste lisible sous le même lien, marqué
 * « ANNULÉ ». On peut ensuite ré-encaisser le bon montant.
 *
 * Un reçu familial s'annule d'un bloc : ses parts ont été versées ensemble,
 * sous un seul numéro.
 */
export async function cancelReceipt(
  tx: Prisma.TransactionClient,
  input: {
    schoolId: string;
    userId: string;
    reason: string;
    target: { paymentId: string } | { familyPaymentId: string };
  },
): Promise<{ count: number; total: number; familyPaymentId: string | null }> {
  const reason = input.reason.trim();
  if (reason.length < 3) throw new UserError("Indiquez le motif de l'annulation.");

  // Le reçu à annuler : un paiement seul, ou toutes les parts d'un reçu familial.
  let familyPaymentId: string | null = null;
  if ("familyPaymentId" in input.target) {
    familyPaymentId = input.target.familyPaymentId;
  } else {
    const payment = await tx.payment.findFirst({
      where: { id: input.target.paymentId, schoolId: input.schoolId },
      select: { familyPaymentId: true },
    });
    if (!payment) {
      const done = await tx.cancelledPayment.count({ where: { id: input.target.paymentId, schoolId: input.schoolId } });
      throw new UserError(done ? "Ce paiement est déjà annulé." : "Paiement introuvable.");
    }
    familyPaymentId = payment.familyPaymentId;
  }

  if (familyPaymentId) {
    const group = await tx.familyPayment.findFirst({
      where: { id: familyPaymentId, schoolId: input.schoolId },
      select: { cancelledAt: true },
    });
    if (!group) throw new UserError("Reçu introuvable.");
    if (group.cancelledAt) throw new UserError("Ce reçu est déjà annulé.");
  }

  const payments = await tx.payment.findMany({
    where: familyPaymentId
      ? { familyPaymentId, schoolId: input.schoolId }
      : { id: (input.target as { paymentId: string }).paymentId, schoolId: input.schoolId },
    include: {
      student: { select: { firstName: true, lastName: true, classRoom: { select: { name: true } } } },
      fee: { select: { id: true, label: true, amount: true } },
    },
  });
  if (payments.length === 0) throw new UserError("Ce reçu ne contient plus aucun paiement.");

  const cancelledAt = new Date();
  await tx.cancelledPayment.createMany({
    data: payments.map((p) => ({
      id: p.id,
      schoolId: input.schoolId,
      studentId: p.studentId,
      studentName: `${p.student.firstName} ${p.student.lastName}`.trim(),
      className: p.student.classRoom?.name ?? null,
      feeId: p.feeId,
      feeLabel: p.fee.label,
      feeAmount: p.fee.amount,
      receiptNumber: p.receiptNumber,
      amount: p.amount,
      method: p.method,
      paidAt: p.paidAt,
      note: p.note,
      recordedByUserId: p.recordedByUserId,
      familyPaymentId: p.familyPaymentId,
      cancelledAt,
      cancelledByUserId: input.userId,
      cancelReason: reason,
    })),
  });
  await tx.payment.deleteMany({ where: { id: { in: payments.map((p) => p.id) } } });

  // Chaque échéance touchée retrouve le statut que disent ses paiements restants.
  const feeIds = [...new Set(payments.map((p) => p.feeId))];
  const remaining = await tx.payment.groupBy({
    by: ["feeId"],
    where: { feeId: { in: feeIds } },
    _sum: { amount: true },
  });
  for (const fee of new Map(payments.map((p) => [p.fee.id, p.fee])).values()) {
    const paid = remaining.find((r) => r.feeId === fee.id)?._sum.amount ?? 0;
    await tx.fee.update({
      where: { id: fee.id },
      data: { status: paid >= fee.amount ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING" },
    });
  }

  if (familyPaymentId) {
    await tx.familyPayment.update({
      where: { id: familyPaymentId },
      data: { cancelledAt, cancelledByUserId: input.userId, cancelReason: reason },
    });
  }
  const total = payments.reduce((s, p) => s + p.amount, 0);
  const number = familyPaymentId
    ? ((await tx.familyPayment.findUnique({ where: { id: familyPaymentId }, select: { receiptNumber: true } }))?.receiptNumber ?? "")
    : payments[0].receiptNumber;
  const names = [...new Set(payments.map((p) => `${p.student.firstName} ${p.student.lastName}`.trim()))].join(", ");
  await logActivity(tx, {
    schoolId: input.schoolId,
    userId: input.userId,
    action: ACTIVITY_ACTIONS.CANCEL,
    summary: `Reçu ${number} annulé — ${names} — motif : ${reason}`,
    amount: total,
    href: familyPaymentId ? `/directeur/finance/recus/famille/${familyPaymentId}` : `/directeur/finance/recus/${payments[0].id}`,
  });
  return { count: payments.length, total, familyPaymentId };
}
