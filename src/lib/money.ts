import { formatAmount } from "@/lib/format";
import { remainingOf } from "@/lib/fee-status";

/**
 * L'argent d'une école, une seule règle pour tous les écrans.
 *
 * Madrasati ne décide aucun montant : elle additionne ce que le directeur a
 * saisi (les frais) et ce qui a été encaissé (les paiements). Aucun total
 * n'est stocké comme vérité — il est recalculé ici, à partir des lignes, par
 * simple addition. La fiche famille, la page Parents, le tableau de bord et
 * les relances lisent tous cette même règle.
 *
 * Sans dépendance à la base ni à React : testé à part (tests/money.test.ts).
 */

export interface MoneyLine {
  /** Montant dû saisi par le directeur, en MRU. */
  amount: number;
  /** Total déjà versé sur cette ligne, en MRU. */
  paid: number;
  /** Échéance de la ligne. */
  dueDate: Date | string;
}

export interface Balance {
  /** Total des montants de l'année (toutes les lignes). */
  billed: number;
  /** Total versé. */
  paid: number;
  /** Reste dû à ce jour : lignes arrivées à échéance, pas encore soldées. */
  due: number;
  /** Reste à venir : lignes dont l'échéance n'est pas encore arrivée. */
  upcoming: number;
}

/**
 * Situation de lignes de frais : un mois payé d'avance (juin) est soldé et
 * ne compte nulle part ; un mois pas encore arrivé n'est pas un impayé, il
 * est « à venir ». Un trop-perçu sur une ligne ne comble jamais une autre.
 */
export function balanceOf(lines: MoneyLine[], now = new Date()): Balance {
  return lines.reduce<Balance>(
    (acc, line) => {
      const remaining = remainingOf({ amount: line.amount, totalPaid: line.paid });
      const isDue = new Date(line.dueDate) <= now;
      return {
        billed: acc.billed + line.amount,
        paid: acc.paid + line.paid,
        due: acc.due + (isDue ? remaining : 0),
        upcoming: acc.upcoming + (isDue ? 0 : remaining),
      };
    },
    { billed: 0, paid: 0, due: 0, upcoming: 0 },
  );
}

// —— Unité des montants : MRU, ou MRO (anciens ouguiyas) ——

export const AMOUNT_UNITS = ["MRU", "MRO"] as const;
export type AmountUnit = (typeof AMOUNT_UNITS)[number];

export function isAmountUnit(value: unknown): value is AmountUnit {
  return value === "MRU" || value === "MRO";
}

/** 10 MRO = 1 MRU. */
const MRO_PER_MRU = 10;

/**
 * Montant saisi dans l'unité de l'école → MRU entiers, ou un message
 * d'erreur clair. En MRO, un montant qui ne se termine pas par 0 ne tombe
 * pas sur un MRU entier : il est refusé, jamais arrondi en silence.
 */
export function toMru(raw: string, unit: AmountUnit): { mru: number; error: string | null } {
  const text = raw.replace(/\s/g, "");
  if (text === "") return { mru: 0, error: null };
  if (!/^\d+$/.test(text)) return { mru: 0, error: "Montant invalide : chiffres seulement." };
  const value = Number(text);
  if (unit === "MRU") return { mru: value, error: null };
  if (value % MRO_PER_MRU !== 0) {
    return {
      mru: 0,
      error: `${formatAmount(value)} MRO ne correspond pas à un montant en MRU entier : un montant en MRO se termine par 0.`,
    };
  }
  return { mru: value / MRO_PER_MRU, error: null };
}

/** MRU → texte saisi dans l'unité de l'école (« 13000 » pour 1 300 MRU en MRO). */
export function fromMru(mru: number, unit: AmountUnit): string {
  return String(unit === "MRO" ? mru * MRO_PER_MRU : mru);
}

/** « 1 300 MRU », ou « 13 000 MRO (1 300 MRU) » pour une école qui écrit en MRO. */
export function formatMoney(mru: number, unit: AmountUnit): string {
  if (unit === "MRO") return `${formatAmount(mru * MRO_PER_MRU)} MRO (${formatAmount(mru)} MRU)`;
  return `${formatAmount(mru)} MRU`;
}
