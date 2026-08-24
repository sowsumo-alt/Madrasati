/**
 * Lecture d'un frais de scolarité : ce qu'il reste à percevoir, et sous quel
 * statut la ligne doit apparaître.
 *
 * La règle vit ici, en dehors de l'écran, parce qu'elle a déjà induit le
 * directeur en erreur : le retard écrasait le versement partiel, si bien qu'un
 * frais de 15 000 MRU sur lequel 1 000 venaient d'être encaissés continuait
 * d'afficher « Impayé » et « 15 000 MRU », exactement comme avant le
 * paiement. Rien sur la ligne ne bougeait, et l'encaissement passait pour
 * perdu alors qu'il était bien enregistré.
 */

export interface FeeAmounts {
  amount: number;
  totalPaid: number;
  /** Date d'échéance, ISO ou Date. */
  dueDate: string | Date;
}

export type FeeDisplayStatus = "PAID" | "PARTIAL" | "OVERDUE" | "PENDING";

/** Reste à percevoir, jamais négatif : un trop-perçu ne crée pas de dette. */
export function remainingOf(fee: Pick<FeeAmounts, "amount" | "totalPaid">) {
  return Math.max(fee.amount - fee.totalPaid, 0);
}

/**
 * Statut affiché, déduit des montants et non du champ enregistré en base :
 * la ligne reste juste même si le statut stocké a pris du retard.
 *
 * Un versement partiel prime sur le retard. Les deux informations ne sont pas
 * de même nature — l'une dit où en est le règlement, l'autre depuis quand il
 * traîne — et les faire porter par le même badge en perdait une. L'ancienneté
 * du retard est signalée à part (voir isLate).
 */
export function feeDisplayStatus(fee: FeeAmounts, now = new Date()): FeeDisplayStatus {
  if (remainingOf(fee) <= 0) return "PAID";
  if (fee.totalPaid > 0) return "PARTIAL";
  return new Date(fee.dueDate) < now ? "OVERDUE" : "PENDING";
}

/** Échéance dépassée sur un frais non soldé — partiellement réglé ou non. */
export function isLate(fee: FeeAmounts, now = new Date()) {
  return remainingOf(fee) > 0 && new Date(fee.dueDate) < now;
}
