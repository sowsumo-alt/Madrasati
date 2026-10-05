import { z } from "zod";
import { monthLabel } from "@/lib/tuition";

/**
 * Fiche de paiement d'une famille — la copie de la fiche papier d'IBDAA 2 :
 * UN montant mensuel et UNE inscription pour toute la famille, un tableau
 * des mois, et ce qui est versé aujourd'hui ligne par ligne.
 *
 * Madrasati ne décide rien : aucun montant n'est multiplié par le nombre
 * d'enfants ni déduit d'un autre. Le total versé est la simple somme des
 * lignes saisies. L'écran, la fenêtre de confirmation, le serveur et le reçu
 * lisent tous les lignes produites ici (sheetLines).
 *
 * Sans dépendance à la base ni à React : testé à part
 * (tests/family-sheet.test.ts).
 */

export interface FamilySheetInput {
  /** Rang de l'élève référent parmi les enfants saisis (0 : le premier). */
  referentIndex: number;
  /** Montant mensuel saisi par le directeur, en MRU. */
  monthly: number;
  /** Frais d'inscription : montant saisi, et ce qui en est versé aujourd'hui. */
  enrollment: { due: number; paid: number };
  /** Mois versés aujourd'hui (ISO, premier jour du mois) et le montant versé pour chacun. */
  months: { month: string; paid: number }[];
}

export const familySheetSchema = z.object({
  referentIndex: z.number().int().min(0).max(19),
  monthly: z.number().int().min(0).max(10_000_000),
  enrollment: z.object({
    due: z.number().int().min(0).max(10_000_000),
    paid: z.number().int().min(0).max(10_000_000),
  }),
  months: z
    .array(z.object({ month: z.string().min(1), paid: z.number().int().min(0).max(10_000_000) }))
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
  /** Montant versé aujourd'hui. */
  paid: number;
  /** Solde de la ligne : dû − versé. */
  balance: number;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Les lignes réglées aujourd'hui : chaque mois versé (dû = le montant
 * mensuel saisi), puis l'inscription. Dans l'ordre des mois.
 */
export function sheetLines(input: FamilySheetInput): SheetLine[] {
  const months: SheetLine[] = [...input.months]
    .filter((m) => m.paid > 0)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({
      key: m.month,
      kind: "MONTH" as const,
      label: capitalize(monthLabel(new Date(m.month))),
      month: m.month,
      due: input.monthly,
      paid: m.paid,
      balance: input.monthly - m.paid,
    }));
  const enrollment: SheetLine[] =
    input.enrollment.due > 0 || input.enrollment.paid > 0
      ? [
          {
            key: "inscription",
            kind: "ENROLLMENT",
            label: "Frais d'inscription",
            month: null,
            due: input.enrollment.due,
            paid: input.enrollment.paid,
            balance: input.enrollment.due - input.enrollment.paid,
          },
        ]
      : [];
  return [...months, ...enrollment];
}

/** Total versé aujourd'hui et reste dû sur ces lignes : de simples additions. */
export function sheetTotals(lines: SheetLine[]): { paid: number; balance: number } {
  return lines.reduce(
    (acc, line) => ({ paid: acc.paid + line.paid, balance: acc.balance + Math.max(line.balance, 0) }),
    { paid: 0, balance: 0 },
  );
}

/**
 * Ce qui empêche d'enregistrer la fiche, en clair. On ne verse pas plus que
 * le montant d'une ligne : un mois de 1 300 MRU ne reçoit pas 1 500.
 */
export function sheetErrors(input: FamilySheetInput): string[] {
  const errors: string[] = [];
  const months = input.months.filter((m) => m.paid > 0);
  if (months.length > 0 && input.monthly <= 0) {
    errors.push("Indiquez le montant mensuel avant de cocher des mois.");
  }
  for (const line of sheetLines(input)) {
    if (line.kind === "MONTH" && input.monthly > 0 && line.paid > line.due) {
      errors.push(`${line.label} : le montant versé dépasse le montant mensuel.`);
    }
    if (line.kind === "ENROLLMENT" && line.paid > line.due) {
      errors.push("Frais d'inscription : le montant versé dépasse le montant de l'inscription.");
    }
  }
  if (new Set(months.map((m) => m.month)).size !== months.length) {
    errors.push("Un même mois est coché deux fois.");
  }
  return errors;
}
