import { balanceOf } from "@/lib/money";

/**
 * Rapport financier d'une école, pour une année scolaire (et un mois, au
 * choix). Les montants dus viennent de la même règle que le reste de
 * l'application (lib/money.ts : balanceOf) ; l'argent encaissé, des
 * paiements eux-mêmes. Une famille est comptée une seule fois dans les
 * impayés, jamais une fois par enfant.
 *
 * Sans dépendance à la base ni à React : testé à part (tests/financial-report.test.ts).
 */

export type FeeKind = "ENROLLMENT" | "TUITION" | "OTHER";

export const FEE_KIND_LABELS: Record<FeeKind, string> = {
  ENROLLMENT: "Frais d'inscription",
  TUITION: "Frais de scolarité",
  OTHER: "Autres frais",
};

export function feeKind(label: string): FeeKind {
  if (/^Frais d'inscription|^Frais de réinscription/i.test(label)) return "ENROLLMENT";
  if (/^Frais de scolarité/i.test(label)) return "TUITION";
  return "OTHER";
}

export interface ReportFee {
  studentId: string;
  className: string | null;
  label: string;
  amount: number;
  dueDate: Date;
  /** Tout ce que ce frais a reçu (pour ce qui reste dû). */
  paid: number;
}

export interface ReportPayment {
  amount: number;
  method: string;
  paidAt: Date;
}

/** Une famille (ou un élève seul) : ce sous quoi un impayé est compté. */
export interface DebtorGroup {
  key: string;
  label: string;
  href: string;
}

export interface Breakdown {
  label: string;
  billed: number;
  paid: number;
  due: number;
}

export interface FinancialReport {
  totals: { billed: number; paid: number; due: number; upcoming: number };
  collected: number;
  receipts: number;
  byMethod: { method: string; amount: number; count: number; share: number }[];
  byClass: Breakdown[];
  byKind: Breakdown[];
  topDebtors: { label: string; href: string; due: number }[];
  cancelled: { count: number; amount: number };
}

function breakdown(fees: ReportFee[], keyOf: (f: ReportFee) => string, now: Date): Breakdown[] {
  const groups = new Map<string, ReportFee[]>();
  for (const fee of fees) groups.set(keyOf(fee), [...(groups.get(keyOf(fee)) ?? []), fee]);
  return [...groups.entries()]
    .map(([label, list]) => {
      const b = balanceOf(list.map((f) => ({ amount: f.amount, paid: f.paid, dueDate: f.dueDate })), now);
      return { label, billed: b.billed, paid: b.paid, due: b.due };
    })
    .sort((a, b) => b.billed - a.billed);
}

export function buildFinancialReport(input: {
  /** Les frais de l'année scolaire. */
  fees: ReportFee[];
  /** Les paiements de la période (l'année, ou le mois choisi). */
  payments: ReportPayment[];
  /** Les reçus annulés de la période. */
  cancelled: { amount: number }[];
  /** Le reçu de chaque paiement de la période, pour compter les reçus (un reçu familial = un). */
  receiptKeys: string[];
  /** Famille (ou élève seul) de chaque élève. */
  groupOf: (studentId: string) => DebtorGroup;
  now: Date;
}): FinancialReport {
  const { fees, payments, now } = input;
  const totals = balanceOf(fees.map((f) => ({ amount: f.amount, paid: f.paid, dueDate: f.dueDate })), now);
  const collected = payments.reduce((sum, p) => sum + p.amount, 0);

  const methods = new Map<string, { amount: number; count: number }>();
  for (const p of payments) {
    const m = methods.get(p.method) ?? { amount: 0, count: 0 };
    methods.set(p.method, { amount: m.amount + p.amount, count: m.count + 1 });
  }
  const byMethod = [...methods.entries()]
    .map(([method, m]) => ({ method, ...m, share: collected > 0 ? Math.round((m.amount * 100) / collected) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  // Les impayés par famille : ses frais additionnés, comptés une fois.
  const debtors = new Map<string, { label: string; href: string; lines: ReportFee[] }>();
  for (const fee of fees) {
    const group = input.groupOf(fee.studentId);
    const entry = debtors.get(group.key) ?? { label: group.label, href: group.href, lines: [] };
    entry.lines.push(fee);
    debtors.set(group.key, entry);
  }
  const topDebtors = [...debtors.values()]
    .map((d) => ({
      label: d.label,
      href: d.href,
      due: balanceOf(d.lines.map((f) => ({ amount: f.amount, paid: f.paid, dueDate: f.dueDate })), now).due,
    }))
    .filter((d) => d.due > 0)
    .sort((a, b) => b.due - a.due)
    .slice(0, 10);

  return {
    totals,
    collected,
    receipts: new Set(input.receiptKeys).size,
    byMethod,
    byClass: breakdown(fees, (f) => f.className ?? "Sans classe", now),
    byKind: breakdown(fees, (f) => FEE_KIND_LABELS[feeKind(f.label)], now),
    topDebtors,
    cancelled: { count: input.cancelled.length, amount: input.cancelled.reduce((sum, c) => sum + c.amount, 0) },
  };
}

/** « REC-2026-0012-2 » → « REC-2026-0012 » : les parts d'un reçu familial font un seul reçu. */
export function receiptKey(receiptNumber: string): string {
  return receiptNumber.split("-").slice(0, 3).join("-");
}
