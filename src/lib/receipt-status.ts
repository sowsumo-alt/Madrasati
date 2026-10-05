import { balanceOf } from "@/lib/money";

/**
 * Ce que dit un reçu de la situation, au moment du paiement : le reste dû
 * après ce paiement et le tampon.
 *
 * - « PAIEMENT PARTIEL » : une ligne de ce reçu n'est pas soldée ;
 * - « PAYÉ » : rien n'est dû à cette date — la famille (ou l'élève) est à jour ;
 * - « REÇU » : les lignes du reçu sont réglées, mais il reste d'autres mois dus.
 *
 * Le reste dû est celui de la page famille (lib/money.ts : mois échus non
 * réglés), compté à la date du paiement : un ancien reçu dit toujours ce qui
 * était vrai le jour où il a été remis. Sans base ni React : testé à part.
 */
export type ReceiptStamp = "PAID" | "RECEIVED" | "PARTIAL";

export const STAMP_LABELS: Record<ReceiptStamp, string> = {
  PAID: "Payé",
  RECEIVED: "Reçu",
  PARTIAL: "Paiement partiel",
};

/** « REC-2026-0011-2 » → 11 : le rang du reçu (ses parts ont le même). */
export function receiptRank(receiptNumber: string): number {
  return Number(receiptNumber.split("-")[2] ?? 0) || 0;
}

export interface StandingFee {
  id: string;
  amount: number;
  dueDate: Date;
  payments: { amount: number; paidAt: Date; receiptNumber: string }[];
}

export interface ReceiptStanding {
  /** Reste dû (mois échus) après ce paiement, pour toute la famille ou l'élève. */
  dueAfter: number;
  /** Ce qui manque encore sur les lignes de ce reçu. */
  linesLeft: number;
  stamp: ReceiptStamp;
}

export function receiptStanding(input: {
  /** Tous les frais de la famille (ou de l'élève). */
  fees: StandingFee[];
  /** Les frais réglés par ce reçu. */
  receiptFeeIds: string[];
  /** Date du paiement et numéro du reçu. */
  paidAt: Date;
  receiptNumber: string;
}): ReceiptStanding {
  const at = input.paidAt.getTime();
  const rank = receiptRank(input.receiptNumber);
  // Versé jusqu'à ce reçu inclus : les paiements datés d'avant, et ceux du
  // même instant dont le numéro ne vient pas après.
  const counted = (p: { paidAt: Date; receiptNumber: string }) =>
    p.paidAt.getTime() < at || (p.paidAt.getTime() === at && receiptRank(p.receiptNumber) <= rank);
  const paidOf = (fee: StandingFee) => fee.payments.filter(counted).reduce((sum, p) => sum + p.amount, 0);

  // Échu à la date du paiement : tout ce qui tombe ce jour-là compris.
  const day = input.paidAt;
  const endOfDay = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 23, 59, 59, 999));
  const { due } = balanceOf(
    input.fees.map((f) => ({ amount: f.amount, paid: paidOf(f), dueDate: f.dueDate })),
    endOfDay,
  );
  const lines = new Set(input.receiptFeeIds);
  const linesLeft = input.fees
    .filter((f) => lines.has(f.id))
    .reduce((sum, f) => sum + Math.max(f.amount - paidOf(f), 0), 0);

  const stamp: ReceiptStamp = linesLeft > 0 ? "PARTIAL" : due > 0 ? "RECEIVED" : "PAID";
  return { dueAfter: due, linesLeft, stamp };
}

/**
 * La ligne du reçu : « Reste dû après ce paiement : 1 600 MRU », et ce qui
 * manque encore sur ses propres lignes quand elles ne sont pas soldées — un
 * « Paiement partiel » sur un mois pas encore échu ne doit pas laisser croire
 * que tout est réglé.
 */
export function receiptBalanceText(standing: ReceiptStanding, format: (mru: number) => string): string {
  const text = `Reste dû après ce paiement : ${format(standing.dueAfter)}`;
  return standing.linesLeft > 0 ? `${text} (${format(standing.linesLeft)} restent sur ce reçu)` : text;
}
