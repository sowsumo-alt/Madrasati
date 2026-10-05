import { z } from "zod";
import { monthLabel } from "@/lib/tuition";

/**
 * Fiche de paiement — la copie de la fiche papier d'IBDAA 2 : UN montant
 * mensuel et UNE inscription pour la fiche, le tableau des mois, et ce qui
 * est versé, ligne par ligne, chaque ligne à sa date. Une fiche familiale
 * (plusieurs enfants, un élève référent) ou la fiche d'un seul élève : la
 * même fiche, le même calcul.
 *
 * Madrasati ne décide rien : aucun montant n'est multiplié par le nombre
 * d'enfants ni déduit d'un autre. Le total versé est la simple somme des
 * lignes saisies. L'écran, la fenêtre de confirmation, le serveur et le reçu
 * lisent tous les lignes produites ici (sheetLines).
 *
 * Sans dépendance à la base ni à React : testé à part
 * (tests/family-sheet.test.ts).
 */

/** Ce qu'une ligne de la fiche a déjà reçu (fiche déjà saisie, reprise de l'existant). */
export interface SheetAlready {
  /** Par mois (ISO) : le montant de l'échéance et ce qu'elle a déjà reçu. */
  months: Record<string, { due: number; paid: number }>;
  /** L'inscription déjà enregistrée : son montant et ce qu'elle a reçu. */
  enrollment: { due: number; paid: number } | null;
}

export interface FamilySheetInput {
  /** Rang de l'élève référent parmi les enfants saisis (0 : le premier). */
  referentIndex: number;
  /** Montant mensuel saisi par le directeur, en MRU. */
  monthly: number;
  /** Premier mois facturé (ISO) ; absent : le mois de l'inscription. */
  firstMonth?: string;
  /** Frais d'inscription : montant saisi, ce qui en est versé, et à quelle date (AAAA-MM-JJ). */
  enrollment: { due: number; paid: number; date?: string };
  /** Mois versés (ISO, premier jour du mois), le montant versé et la date de chacun. */
  months: { month: string; paid: number; date?: string }[];
  /** Déjà reçu avant cette saisie : relu en base par le serveur, jamais cru sur parole. */
  already?: SheetAlready;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

export const familySheetSchema = z.object({
  referentIndex: z.number().int().min(0).max(19),
  monthly: z.number().int().min(0).max(10_000_000),
  firstMonth: z.string().min(1).optional(),
  enrollment: z.object({
    due: z.number().int().min(0).max(10_000_000),
    paid: z.number().int().min(0).max(10_000_000),
    date: isoDate.optional(),
  }),
  months: z
    .array(
      z.object({
        month: z.string().min(1),
        paid: z.number().int().min(0).max(10_000_000),
        date: isoDate.optional(),
      }),
    )
    .max(24),
});

export interface SheetLine {
  key: string;
  kind: "MONTH" | "ENROLLMENT";
  /** « Octobre 2026 », « Frais d'inscription ». */
  label: string;
  /** Mois concerné (ISO), pour une ligne de mois. */
  month: string | null;
  /** Montant dû de la ligne, tel que saisi. */
  due: number;
  /** Déjà reçu avant cette saisie. */
  before: number;
  /** Montant versé maintenant. */
  paid: number;
  /** Date du versement (AAAA-MM-JJ) ; absente : aujourd'hui. */
  date: string | null;
  /** Solde de la ligne : dû − déjà reçu − versé. */
  balance: number;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** La date du jour, AAAA-MM-JJ, à l'heure locale. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Les lignes versées : chaque mois versé (dû = le montant mensuel saisi, ou
 * celui de l'échéance déjà en partie réglée), puis l'inscription. Dans
 * l'ordre des mois.
 */
export function sheetLines(input: FamilySheetInput): SheetLine[] {
  const months: SheetLine[] = [...input.months]
    .filter((m) => m.paid > 0)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => {
      const already = input.already?.months[m.month];
      const due = already?.due ?? input.monthly;
      const before = already?.paid ?? 0;
      return {
        key: m.month,
        kind: "MONTH" as const,
        label: capitalize(monthLabel(new Date(m.month))),
        month: m.month,
        due,
        before,
        paid: m.paid,
        date: m.date ?? null,
        balance: due - before - m.paid,
      };
    });
  const before = input.already?.enrollment?.paid ?? 0;
  const enrollment: SheetLine[] =
    input.enrollment.paid > 0 || (input.enrollment.due > 0 && !input.already?.enrollment)
      ? [
          {
            key: "inscription",
            kind: "ENROLLMENT",
            label: "Frais d'inscription",
            month: null,
            due: input.enrollment.due,
            before,
            paid: input.enrollment.paid,
            date: input.enrollment.date ?? null,
            balance: input.enrollment.due - before - input.enrollment.paid,
          },
        ]
      : [];
  return [...months, ...enrollment];
}

/** Total versé et reste dû sur ces lignes : de simples additions. */
export function sheetTotals(lines: SheetLine[]): { paid: number; balance: number } {
  return lines.reduce(
    (acc, line) => ({ paid: acc.paid + line.paid, balance: acc.balance + Math.max(line.balance, 0) }),
    { paid: 0, balance: 0 },
  );
}

const shortDate = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Ce qui empêche d'enregistrer la fiche, en clair. On ne verse pas plus que
 * ce qui reste dû sur une ligne : un mois de 1 300 MRU ne reçoit pas 1 500.
 * Une date passée est acceptée (reprise des fiches papier), pas une date à venir.
 */
export function sheetErrors(input: FamilySheetInput, today = todayIso()): string[] {
  const errors: string[] = [];
  const months = input.months.filter((m) => m.paid > 0);
  if (months.length > 0 && input.monthly <= 0 && months.some((m) => !input.already?.months[m.month])) {
    errors.push("Indiquez le montant mensuel avant de cocher des mois.");
  }
  if (input.already?.enrollment && input.enrollment.due < input.already.enrollment.paid) {
    errors.push("Frais d'inscription : le montant est inférieur à ce qui a déjà été versé.");
  }
  for (const line of sheetLines(input)) {
    if (line.kind === "MONTH" && line.due > 0 && line.balance < 0) {
      errors.push(
        line.before > 0
          ? `${line.label} : le montant versé dépasse le reste dû (${line.due - line.before}).`
          : `${line.label} : le montant versé dépasse le montant mensuel.`,
      );
    }
    if (line.kind === "ENROLLMENT" && line.balance < 0 && !(input.already?.enrollment && input.enrollment.due < line.before)) {
      errors.push("Frais d'inscription : le montant versé dépasse le montant de l'inscription.");
    }
    if (line.paid > 0 && line.date && line.date > today) {
      errors.push(`${line.label} : la date ${shortDate(line.date)} n'est pas encore arrivée.`);
    }
  }
  if (new Set(months.map((m) => m.month)).size !== months.length) {
    errors.push("Un même mois est coché deux fois.");
  }
  return errors;
}
