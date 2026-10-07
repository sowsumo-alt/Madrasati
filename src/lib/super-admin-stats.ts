/**
 * Calculs du tableau de bord Super Admin : revenus par mois et leur
 * évolution, dates relatives, code d'école. Sans dépendance à la base ni à
 * React : testé à part (tests/super-admin-stats.test.ts).
 */

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

export interface MonthWindow {
  label: string;
  year: number;
  /** 0 = janvier. */
  month: number;
}

/** Les `count` derniers mois, du plus ancien au plus récent (mois en cours compris). */
export function lastMonths(now: Date, count: number): MonthWindow[] {
  const months: MonthWindow[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: MONTH_LABELS[d.getMonth()], year: d.getFullYear(), month: d.getMonth() });
  }
  return months;
}

/** Variation en %, arrondie ; null quand la période précédente est vide (pas de base de comparaison). */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) * 100) / previous);
}

export interface RevenuePeriod {
  /** Un point par mois de la période. */
  points: { label: string; value: number }[];
  total: number;
  /** Même nombre de mois, juste avant. */
  previousTotal: number;
  change: number | null;
}

/** Revenus encaissés sur les `count` derniers mois, et leur évolution par rapport aux `count` mois d'avant. */
export function revenuePeriod(payments: { paidAt: Date; amount: number }[], now: Date, count: number): RevenuePeriod {
  const both = lastMonths(now, count * 2);
  const sumOf = (m: MonthWindow) =>
    payments
      .filter((p) => p.paidAt.getFullYear() === m.year && p.paidAt.getMonth() === m.month)
      .reduce((sum, p) => sum + p.amount, 0);
  const previous = both.slice(0, count);
  const current = both.slice(count);
  const points = current.map((m) => ({ label: m.label, value: sumOf(m) }));
  const total = points.reduce((sum, p) => sum + p.value, 0);
  const previousTotal = previous.reduce((sum, m) => sum + sumOf(m), 0);
  return { points, total, previousTotal, change: percentChange(total, previousTotal) };
}

/** « à l'instant », « il y a 5 min », « il y a 2 h », « il y a 3 j », puis la date. */
export function relativeTime(date: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/** Code court d'une école, dans l'ordre de son inscription : 1 → « #E001 ». */
export function schoolCode(rank: number): string {
  return `#E${String(rank).padStart(3, "0")}`;
}
