/**
 * Formules de paiement des frais de scolarité : un parent règle chaque mois,
 * par trimestre, par période de N mois (« 4 mois en une fois »), ou l'année
 * entière. La formule découpe les mois facturés de l'année en échéances ;
 * chaque échéance vaut le montant mensuel × ses mois, et dit les mois qu'elle
 * couvre — c'est ce qu'imprime le reçu.
 *
 * Sans dépendance à la base ni à React : testé à part (tests/tuition.test.ts).
 * Les mois sont des dates UTC au premier jour du mois.
 */

export const TUITION_FREQUENCIES = ["MONTHLY", "QUARTERLY", "CUSTOM", "ANNUAL"] as const;
export type TuitionFrequency = (typeof TUITION_FREQUENCIES)[number];

export function isTuitionFrequency(value: string): value is TuitionFrequency {
  return (TUITION_FREQUENCIES as readonly string[]).includes(value);
}

export const FREQUENCY_LABELS: Record<TuitionFrequency, string> = {
  MONTHLY: "Mensuel",
  QUARTERLY: "Trimestriel (3 mois)",
  CUSTOM: "Personnalisé",
  ANNUAL: "Annuel (toute l'année)",
};

const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** Premier jour du mois d'une date, en UTC. */
export function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addMonths(month: Date, count: number): Date {
  return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + count, 1));
}

/** « octobre 2026 » */
export function monthLabel(month: Date): string {
  return `${MONTH_NAMES[month.getUTCMonth()]} ${month.getUTCFullYear()}`;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Les mois de `first` à `last` inclus. */
export function monthsBetween(first: Date, last: Date): Date[] {
  const months: Date[] = [];
  for (let m = monthStart(first); m <= monthStart(last); m = addMonths(m, 1)) months.push(m);
  return months;
}

/** Mois réglés en une fois pour une formule ; `customMonths` pour « Personnalisé ». */
export function periodMonthsOf(
  frequency: TuitionFrequency,
  customMonths: number,
  monthsInYear: number,
): number {
  if (frequency === "MONTHLY") return 1;
  if (frequency === "QUARTERLY") return 3;
  if (frequency === "ANNUAL") return Math.max(monthsInYear, 1);
  return Math.min(Math.max(Math.round(customMonths), 1), Math.max(monthsInYear, 1));
}

/** Libellé d'une période : « octobre 2026 », « octobre à décembre 2026 », « novembre 2026 à février 2027 ». */
export function periodLabel(start: Date, end: Date): string {
  if (start.getTime() === end.getTime()) return monthLabel(start);
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${MONTH_NAMES[start.getUTCMonth()]} à ${monthLabel(end)}`;
  }
  return `${monthLabel(start)} à ${monthLabel(end)}`;
}

export interface Installment {
  periodStart: Date;
  periodEnd: Date;
  months: number;
  amount: number;
  /** Échéance : le premier jour de la période. */
  dueDate: Date;
  label: string;
}

/**
 * Échéances d'une formule sur les mois encore à facturer. Les mois déjà
 * couverts par une échéance payée sont retirés par l'appelant : la suite
 * est découpée en blocs de `periodMonths` mois consécutifs, le dernier
 * bloc pouvant être plus court (fin d'année).
 *
 * `yearFirstMonth` numérote les trimestres depuis le début de l'année
 * scolaire (« Trimestre 2 »), même si la formule démarre en cours d'année.
 */
export function buildInstallments(options: {
  months: Date[];
  periodMonths: number;
  monthlyAmount: number;
  frequency: TuitionFrequency;
  yearFirstMonth: Date;
  yearLabel?: string;
}): Installment[] {
  const { months, periodMonths, monthlyAmount, frequency, yearFirstMonth, yearLabel } = options;
  const sorted = [...months].sort((a, b) => a.getTime() - b.getTime());

  // Des mois consécutifs seulement dans un même bloc : un mois déjà payé au
  // milieu coupe la suite.
  const runs: Date[][] = [];
  for (const month of sorted) {
    const run = runs[runs.length - 1];
    if (run && addMonths(run[run.length - 1], 1).getTime() === month.getTime()) run.push(month);
    else runs.push([month]);
  }

  const installments: Installment[] = [];
  for (const run of runs) {
    for (let i = 0; i < run.length; i += periodMonths) {
      const chunk = run.slice(i, i + periodMonths);
      const start = chunk[0];
      const end = chunk[chunk.length - 1];
      const period = periodLabel(start, end);
      let label: string;
      if (frequency === "MONTHLY") {
        label = `Frais de scolarité — ${capitalize(period)}`;
      } else if (frequency === "QUARTERLY") {
        const offset =
          (start.getUTCFullYear() - yearFirstMonth.getUTCFullYear()) * 12 +
          start.getUTCMonth() -
          yearFirstMonth.getUTCMonth();
        label = `Frais de scolarité — Trimestre ${Math.floor(offset / 3) + 1} (${period})`;
      } else if (frequency === "ANNUAL") {
        label = `Frais de scolarité — Année${yearLabel ? ` ${yearLabel}` : ""} (${period})`;
      } else {
        label = `Frais de scolarité — ${capitalize(period)} (${chunk.length} mois)`;
      }
      installments.push({
        periodStart: start,
        periodEnd: end,
        months: chunk.length,
        amount: monthlyAmount * chunk.length,
        dueDate: start,
        label,
      });
    }
  }
  return installments;
}

/** Les mois couverts par une échéance (du premier au dernier mois inclus). */
export function coveredMonths(fees: { periodStart: Date | null; periodEnd: Date | null }[]): Set<number> {
  const covered = new Set<number>();
  for (const fee of fees) {
    if (!fee.periodStart || !fee.periodEnd) continue;
    for (const month of monthsBetween(fee.periodStart, fee.periodEnd)) covered.add(month.getTime());
  }
  return covered;
}

/**
 * Part d'une échéance déjà réglée quand le parent a payé jusqu'au mois
 * `through` inclus : ses mois jusque-là, au montant mensuel, sans dépasser
 * l'échéance. Un trimestre dont seul le premier mois est réglé en reçoit un
 * tiers ; une échéance qui commence après `through`, rien.
 */
export function prepaidShare(
  installment: { periodStart: Date; periodEnd: Date; amount: number },
  through: Date,
  monthlyAmount: number,
): number {
  if (installment.periodStart > through) return 0;
  const last = installment.periodEnd < through ? installment.periodEnd : through;
  return Math.min(installment.amount, monthsBetween(installment.periodStart, last).length * monthlyAmount);
}

/** Résumé d'une formule pour le directeur : « Trimestriel — 15 000 MRU tous les 3 mois ». */
export function describePlan(frequency: TuitionFrequency, periodMonths: number): string {
  if (frequency === "MONTHLY") return "Mensuel";
  if (frequency === "QUARTERLY") return "Trimestriel (3 mois)";
  if (frequency === "ANNUAL") return "Annuel (en une fois)";
  return `${periodMonths} mois en une fois`;
}
