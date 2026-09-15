/**
 * Calculs de la page Statistiques, séparés des requêtes pour être vérifiés
 * par des tests (tests/stats-data.test.ts). Dates lues en UTC, l'heure des
 * écoles (voir src/lib/dashboard-data.ts).
 */

import { isInMonth, type MonthKey } from "./dashboard-data";

/**
 * Date jusqu'à laquelle une année scolaire se lit : aujourd'hui tant qu'elle
 * dure, sa fin une fois terminée — les douze mois affichés d'une année passée
 * sont alors les siens, et non ceux qui ont suivi.
 */
export function referenceDate(yearEnd: Date, now: Date): Date {
  return yearEnd.getTime() < now.getTime() ? yearEnd : now;
}

/** Écart en points entre les deux derniers mois d'appel ; `null` sans mois de comparaison. */
export function pointsChange(rates: { rate: number }[]): number | null {
  if (rates.length < 2) return null;
  return rates[rates.length - 1].rate - rates[rates.length - 2].rate;
}

/** Nombre d'évènements (notes saisies, paiements…) mois par mois. */
export function monthlyCounts(dates: Date[], months: MonthKey[]): number[] {
  return months.map((key) => dates.filter((d) => isInMonth(d, key)).length);
}

/**
 * Moyenne de chaque matière ramenée sur 20 — un devoir noté sur 10 compte
 * comme les autres —, de la meilleure à la plus faible.
 */
export function subjectAverages(
  grades: { score: number; maxScore: number; subject: string }[],
): { label: string; value: number }[] {
  const bySubject = new Map<string, { total: number; count: number }>();
  for (const g of grades) {
    const entry = bySubject.get(g.subject) ?? { total: 0, count: 0 };
    entry.total += (g.score / (g.maxScore || 20)) * 20;
    entry.count += 1;
    bySubject.set(g.subject, entry);
  }
  return [...bySubject.entries()]
    .map(([label, { total, count }]) => ({ label, value: Math.round((total / count) * 10) / 10 }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "fr"));
}

/** Effectifs additionnés par niveau, niveaux vides écartés, du plus grand au plus petit. */
export function levelDistribution(
  classes: { level: string; count: number }[],
): { label: string; value: number }[] {
  const byLevel = new Map<string, number>();
  for (const c of classes) byLevel.set(c.level, (byLevel.get(c.level) ?? 0) + c.count);
  return [...byLevel.entries()]
    .map(([label, value]) => ({ label, value }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "fr"));
}
