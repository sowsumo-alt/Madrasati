/**
 * Filtres et chiffres de la liste des paiements, hors de l'écran pour être
 * verrouillés par des tests (tests/payments-list.test.ts).
 *
 * Une ligne de la liste est un frais : réglé, partiellement réglé ou non.
 * C'est ce qui permet de voir sur le même écran l'argent reçu et celui qui
 * reste à percevoir.
 */

import { isLate, type FeeAmounts, type FeeDisplayStatus } from "./fee-status";

const DAY_MS = 86_400_000;

/** « Non réglés » (UNPAID) regroupe en attente, partiel et en retard. */
export const PAYMENT_STATUS_FILTERS = ["ALL", "UNPAID", "PAID", "PARTIAL", "OVERDUE", "PENDING"] as const;
export type PaymentStatusFilter = (typeof PAYMENT_STATUS_FILTERS)[number];

export interface FeeListItem {
  label: string;
  /** ISO */
  dueDate: string;
  status: FeeDisplayStatus;
  student: { firstName: string; lastName: string; classId: string | null };
  parent: { firstName: string; lastName: string; phone: string } | null;
  /** Du plus ancien au plus récent. */
  payments: { receiptNumber: string; method: string; paidAt: string }[];
}

export interface FeeListFilters {
  query: string;
  /** "ALL" ou l'identifiant d'une classe. */
  classId: string;
  status: PaymentStatusFilter;
  /** "ALL", "NONE" (aucun paiement reçu) ou un mode de paiement. */
  method: string;
  /** Jours "AAAA-MM-JJ", bornes incluses ; vide = sans limite. */
  from: string;
  to: string;
}

/** Jour de la colonne « Date » : le dernier paiement reçu, sinon l'échéance. */
export function feeListDay(fee: Pick<FeeListItem, "dueDate" | "payments">): string {
  const last = fee.payments[fee.payments.length - 1];
  return (last ? last.paidAt : fee.dueDate).slice(0, 10);
}

const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function matchesFeeFilters(fee: FeeListItem, filters: FeeListFilters): boolean {
  if (filters.status === "UNPAID" ? fee.status === "PAID" : filters.status !== "ALL" && fee.status !== filters.status) {
    return false;
  }
  if (filters.classId !== "ALL" && fee.student.classId !== filters.classId) return false;
  if (filters.method === "NONE" ? fee.payments.length > 0 : filters.method !== "ALL" && !fee.payments.some((p) => p.method === filters.method)) {
    return false;
  }

  const day = feeListDay(fee);
  if (filters.from && day < filters.from) return false;
  if (filters.to && day > filters.to) return false;

  // Chaque mot doit se retrouver quelque part : « brahim mohamed » trouve le
  // parent « Brahim Ould Mohamed », sans accents ni majuscules à respecter.
  const words = normalize(filters.query.trim()).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalize(
    [
      fee.student.firstName,
      fee.student.lastName,
      fee.parent?.firstName,
      fee.parent?.lastName,
      fee.parent?.phone,
      fee.label,
      ...fee.payments.map((p) => p.receiptNumber),
    ]
      .filter(Boolean)
      .join(" "),
  );
  return words.every((word) => haystack.includes(word));
}

/** Jours civils de retard d'un frais non soldé ; 0 sans retard. */
export function daysOverdue(fee: FeeAmounts, now: Date): number {
  if (!isLate(fee, now)) return 0;
  const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.max(0, Math.round((startOfDay(now) - startOfDay(new Date(fee.dueDate))) / DAY_MS));
}

/**
 * Part de l'argent facturé effectivement encaissée, en pourcentage arrondi.
 * Plafonnée à 100 : un trop-perçu ne fait pas dépasser le recouvrement.
 */
export function collectionRate(billed: number, collected: number): number | null {
  if (billed <= 0) return null;
  return Math.min(100, Math.round((collected / billed) * 100));
}
