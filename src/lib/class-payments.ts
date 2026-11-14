/**
 * Paiements d'une classe pour un mois : qui a payé, qui a payé en partie, qui
 * n'a pas payé — la liste que les écoles tenaient à la main.
 *
 * - Les frais d'un élève pour le mois sont ceux qui COUVRENT ce mois : un mois,
 *   un trimestre ou l'année réglés d'avance comptent, avec leur montant tel
 *   qu'il a été saisi (jamais découpé ni multiplié).
 * - Fiche familiale : ses frais sont portés par un enfant (le référent). Les
 *   autres enfants affichent le statut de la fiche, sans montant : l'argent
 *   d'une famille n'est compté qu'une fois, chez l'enfant qui porte la fiche.
 * - Statut, retard : mêmes règles que la page Paiements (lib/fee-status.ts),
 *   avec l'échéance de l'école (effectiveDueDate).
 *
 * Sans dépendance à la base ni à React (tests/class-payments.test.ts).
 */
import { remainingOf, type FeeDisplayStatus } from "./fee-status";

/** Statut du mois ; NO_FEE : aucun frais ne couvre ce mois pour cet élève. */
export type MonthStatus = FeeDisplayStatus | "NO_FEE";

export interface MonthFee {
  amount: number;
  paid: number;
  /** Moment où le frais devient dû (effectiveDueDate). */
  dueDate: Date;
}

export interface ClassPaymentInput {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string | null;
  /** Ses propres frais qui couvrent le mois. */
  fees: MonthFee[];
  /** Fiche familiale portée par un autre enfant : son statut, sans ses montants. */
  family: { holder: string; holderClass: string | null; fees: MonthFee[] } | null;
}

export interface ClassPaymentRow {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string | null;
  status: MonthStatus;
  amount: number;
  paid: number;
  remaining: number;
  /** Inclus dans la fiche familiale de cet enfant (montants comptés chez lui). */
  family: { holder: string; holderClass: string | null } | null;
}

export interface ClassPaymentTotals {
  students: number;
  expected: number;
  collected: number;
  remaining: number;
  count: Record<MonthStatus, number>;
}

const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);

export function monthStatusOf(fees: MonthFee[], now: Date): MonthStatus {
  if (fees.length === 0) return "NO_FEE";
  const open = fees.filter((f) => remainingOf({ amount: f.amount, totalPaid: f.paid }) > 0);
  if (open.length === 0) return "PAID";
  if (fees.some((f) => f.paid > 0)) return "PARTIAL";
  return open.some((f) => f.dueDate < now) ? "OVERDUE" : "PENDING";
}

export function classPaymentRows(students: ClassPaymentInput[], now: Date) {
  const rows: ClassPaymentRow[] = students.map((s) => {
    const own = s.fees.length > 0;
    const fees = own ? s.fees : (s.family?.fees ?? []);
    return {
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      matricule: s.matricule,
      status: monthStatusOf(fees, now),
      amount: own ? sum(s.fees.map((f) => f.amount)) : 0,
      paid: own ? sum(s.fees.map((f) => f.paid)) : 0,
      remaining: own ? sum(s.fees.map((f) => remainingOf({ amount: f.amount, totalPaid: f.paid }))) : 0,
      family: !own && s.family && s.family.fees.length > 0 ? { holder: s.family.holder, holderClass: s.family.holderClass } : null,
    };
  });
  const count: Record<MonthStatus, number> = { PAID: 0, PARTIAL: 0, OVERDUE: 0, PENDING: 0, NO_FEE: 0 };
  for (const r of rows) count[r.status]++;
  const totals: ClassPaymentTotals = {
    students: rows.length,
    expected: sum(rows.map((r) => r.amount)),
    collected: sum(rows.map((r) => r.paid)),
    remaining: sum(rows.map((r) => r.remaining)),
    count,
  };
  return { rows, totals };
}

/** « 2026-11 » → bornes du mois (UTC) ; null si illisible. */
export function monthWindow(value: string | null | undefined): { key: string; start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  if (month < 0 || month > 11) return null;
  return { key: m[0], start: new Date(Date.UTC(year, month, 1)), end: new Date(Date.UTC(year, month + 1, 1)) };
}

/** Un frais couvre-t-il le mois ? Période de la formule, sinon le mois de son échéance. */
export function feeCoversMonth(
  fee: { periodStart: Date | null; periodEnd: Date | null; dueDate: Date },
  window: { start: Date; end: Date },
): boolean {
  if (!fee.periodStart) return fee.dueDate >= window.start && fee.dueDate < window.end;
  const last = fee.periodEnd ?? fee.periodStart;
  return fee.periodStart < window.end && last >= window.start;
}
