import type { Prisma } from "@prisma/client";
import { UserError } from "@/lib/user-error";
import { formatMRU } from "@/lib/format";
import { ACTIVITY_ACTIONS, logActivity } from "@/lib/activity";
import { cancelReceipt } from "@/lib/payment-cancel";
import { recordGroupedPayment, type PaymentPart } from "@/lib/tuition-plan";

/**
 * Correction d'une fiche de paiement : le directeur tape, ligne par ligne, ce
 * qui a VRAIMENT été versé (le même tableau que la fiche de l'inscription).
 *
 * Rien n'est effacé :
 * - versé en moins (« 10 000 » au lieu de « 1 000 », mois coché par erreur) :
 *   le reçu concerné est annulé — il reste lisible, marqué ANNULÉ, avec le
 *   motif — puis refait, même jour et même mode, sans le trop-perçu ; les
 *   autres lignes d'un reçu groupé sont refaites à l'identique ;
 * - versé en plus : un reçu de complément, daté du jour.
 * L'argent perçu, les statuts et le journal suivent.
 */

export interface CorrectionPayment {
  id: string;
  feeId: string;
  amount: number;
  paidAt: Date;
}

/**
 * Ce qu'il faut retirer de chaque paiement pour ramener chaque frais à son
 * montant voulu : en partant des versements les plus récents (l'erreur est
 * presque toujours la dernière saisie).
 */
export function reductionsByPayment(
  targets: { feeId: string; target: number }[],
  payments: CorrectionPayment[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const { feeId, target } of targets) {
    const ofFee = payments
      .filter((p) => p.feeId === feeId)
      .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime() || (a.id < b.id ? 1 : -1));
    let excess = ofFee.reduce((s, p) => s + p.amount, 0) - target;
    for (const p of ofFee) {
      if (excess <= 0) break;
      const cut = Math.min(p.amount, excess);
      out.set(p.id, cut);
      excess -= cut;
    }
  }
  return out;
}

export interface CorrectionResult {
  cancelled: string[];
  issued: string[];
  /** Premier paiement du reçu à ouvrir après la correction, s'il y en a un. */
  openPaymentId: string | null;
}

export async function correctFeePayments(
  tx: Prisma.TransactionClient,
  input: {
    schoolId: string;
    userId: string;
    attempt: number;
    /** Élèves dont la fiche est corrigée : aucun autre frais n'est touché. */
    studentIds: string[];
    changes: { feeId: string; paid: number }[];
    /** Mode du reçu de complément (versé en plus). */
    method: string;
    reason: string;
  },
): Promise<CorrectionResult> {
  const reason = input.reason.trim();
  if (reason.length < 3) throw new UserError("Indiquez le motif de la correction.");
  const feeIds = [...new Set(input.changes.map((c) => c.feeId))];
  const fees = await tx.fee.findMany({
    where: { id: { in: feeIds }, schoolId: input.schoolId, studentId: { in: input.studentIds } },
    select: {
      id: true,
      amount: true,
      label: true,
      studentId: true,
      payments: { select: { id: true, amount: true, paidAt: true, familyPaymentId: true } },
    },
  });
  if (fees.length !== feeIds.length) throw new UserError("Frais introuvable sur cette fiche.");

  const targets: { feeId: string; target: number }[] = [];
  const additions: PaymentPart[] = [];
  const lines: string[] = [];
  for (const change of input.changes) {
    const fee = fees.find((f) => f.id === change.feeId)!;
    if (!Number.isInteger(change.paid) || change.paid < 0 || change.paid > fee.amount) {
      throw new UserError(`${fee.label} : le montant versé doit être entre 0 et ${formatMRU(fee.amount)}.`);
    }
    const current = fee.payments.reduce((s, p) => s + p.amount, 0);
    if (change.paid === current) continue;
    lines.push(`${fee.label} : ${formatMRU(current)} → ${formatMRU(change.paid)}`);
    if (change.paid < current) targets.push({ feeId: fee.id, target: change.paid });
    else additions.push({ feeId: fee.id, studentId: fee.studentId, amount: change.paid - current, feeAmount: fee.amount, paidBefore: current });
  }
  if (lines.length === 0) throw new UserError("Aucun montant n'a changé.");

  // — Versé en moins : les reçus touchés, annulés puis refaits sans le trop-perçu.
  const allPayments = fees.flatMap((f) => f.payments.map((p) => ({ ...p, feeId: f.id })));
  const cuts = reductionsByPayment(targets, allPayments);
  const receiptKeys = new Map<string, { familyPaymentId: string | null; paymentId: string }>();
  for (const p of allPayments) {
    if (!cuts.get(p.id)) continue;
    const key = p.familyPaymentId ?? p.id;
    if (!receiptKeys.has(key)) receiptKeys.set(key, { familyPaymentId: p.familyPaymentId, paymentId: p.id });
  }

  const cancelled: string[] = [];
  const issued: string[] = [];
  let openPaymentId: string | null = null;
  for (const receipt of receiptKeys.values()) {
    const group = receipt.familyPaymentId
      ? await tx.familyPayment.findUnique({
          where: { id: receipt.familyPaymentId },
          select: { receiptNumber: true, parentId: true, method: true, paidAt: true },
        })
      : null;
    const parts = await tx.payment.findMany({
      where: receipt.familyPaymentId ? { familyPaymentId: receipt.familyPaymentId } : { id: receipt.paymentId },
      select: { id: true, feeId: true, studentId: true, amount: true, method: true, paidAt: true, receiptNumber: true },
    });
    const oldNumber = group?.receiptNumber ?? parts[0].receiptNumber;
    await cancelReceipt(tx, {
      schoolId: input.schoolId,
      userId: input.userId,
      reason: `Correction de la fiche — ${reason}`,
      target: receipt.familyPaymentId ? { familyPaymentId: receipt.familyPaymentId } : { paymentId: receipt.paymentId },
    });
    cancelled.push(oldNumber);

    const kept = parts.map((p) => ({ ...p, amount: p.amount - (cuts.get(p.id) ?? 0) })).filter((p) => p.amount > 0);
    if (kept.length === 0) continue;
    const paidNow = await tx.payment.groupBy({
      by: ["feeId"],
      where: { feeId: { in: kept.map((p) => p.feeId) } },
      _sum: { amount: true },
    });
    const feeAmounts = await tx.fee.findMany({ where: { id: { in: kept.map((p) => p.feeId) } }, select: { id: true, amount: true } });
    const reissued = await recordGroupedPayment(tx, {
      schoolId: input.schoolId,
      userId: input.userId,
      attempt: input.attempt,
      method: group?.method ?? parts[0].method,
      paidAt: group?.paidAt ?? parts[0].paidAt,
      note: `Remplace le reçu ${oldNumber}`,
      parentId: group ? group.parentId : undefined,
      parts: kept.map((p) => ({
        feeId: p.feeId,
        studentId: p.studentId,
        amount: p.amount,
        feeAmount: feeAmounts.find((f) => f.id === p.feeId)?.amount ?? p.amount,
        paidBefore: paidNow.find((s) => s.feeId === p.feeId)?._sum.amount ?? 0,
      })),
    });
    const newNumber = reissued.groupId
      ? (await tx.familyPayment.findUnique({ where: { id: reissued.groupId }, select: { receiptNumber: true } }))?.receiptNumber
      : (await tx.payment.findUnique({ where: { id: reissued.firstPaymentId! }, select: { receiptNumber: true } }))?.receiptNumber;
    if (newNumber) {
      issued.push(newNumber);
      // Le reçu annulé dit par quel reçu il a été remplacé.
      const replaced = `Correction de la fiche — remplacé par le reçu ${newNumber} — ${reason}`;
      await tx.cancelledPayment.updateMany({ where: { id: { in: parts.map((p) => p.id) } }, data: { cancelReason: replaced } });
      if (receipt.familyPaymentId) {
        await tx.familyPayment.update({ where: { id: receipt.familyPaymentId }, data: { cancelReason: replaced } });
      }
    }
    openPaymentId ??= reissued.firstPaymentId;
  }

  // — Versé en plus : un reçu de complément, daté du jour.
  if (additions.length > 0) {
    const added = await recordGroupedPayment(tx, {
      schoolId: input.schoolId,
      userId: input.userId,
      attempt: input.attempt,
      method: input.method,
      note: `Complément — correction de la fiche — ${reason}`,
      parts: additions,
    });
    const number = added.groupId
      ? (await tx.familyPayment.findUnique({ where: { id: added.groupId }, select: { receiptNumber: true } }))?.receiptNumber
      : (await tx.payment.findUnique({ where: { id: added.firstPaymentId! }, select: { receiptNumber: true } }))?.receiptNumber;
    if (number) issued.push(number);
    openPaymentId ??= added.firstPaymentId;
  }

  await logActivity(tx, {
    schoolId: input.schoolId,
    userId: input.userId,
    action: ACTIVITY_ACTIONS.PAYMENT,
    summary: `Fiche de paiement corrigée — ${lines.join(" ; ")}${cancelled.length ? ` — reçus annulés : ${cancelled.join(", ")}` : ""}${issued.length ? ` — nouveaux reçus : ${issued.join(", ")}` : ""} — motif : ${reason}`,
  });
  return { cancelled, issued, openPaymentId };
}
