/**
 * Calculs du tableau de bord directeur, séparés des requêtes pour être
 * vérifiés par des tests (tests/dashboard-data.test.ts).
 *
 * Les dates sont lues en UTC : c'est l'heure de la Mauritanie toute l'année
 * (voir TIME_ZONE dans src/lib/format.ts) et celle du serveur. Lire l'heure
 * locale de la machine rangeait autrement un appel fait tard le soir dans un
 * jour différent selon l'ordinateur qui affichait la page.
 */

const DAY_MS = 86_400_000;

export interface MonthKey {
  year: number;
  /** 0 = janvier */
  month: number;
}

export interface Share {
  label: string;
  value: number;
}

/** Les `count` derniers mois, du plus ancien au mois en cours. */
export function lastMonthKeys(now: Date, count: number): MonthKey[] {
  const keys: MonthKey[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
  }
  return keys;
}

export function isInMonth(date: Date, key: MonthKey) {
  return date.getUTCFullYear() === key.year && date.getUTCMonth() === key.month;
}

/**
 * Total atteint à la fin de chaque mois (arrivées cumulées) : la mini-courbe
 * d'un effectif qui grandit, pas celle des seules arrivées du mois.
 */
export function runningTotals(createdAt: Date[], months: MonthKey[]): number[] {
  return months.map((key) => {
    const end = Date.UTC(key.year, key.month + 1, 1);
    return createdAt.filter((d) => d.getTime() < end).length;
  });
}

/** Montants additionnés mois par mois (argent perçu). */
export function monthlySums(
  entries: { at: Date; amount: number }[],
  months: MonthKey[],
): number[] {
  return months.map((key) =>
    entries.reduce((sum, e) => (isInMonth(e.at, key) ? sum + e.amount : sum), 0),
  );
}

/**
 * Évolution en pourcentage, arrondie. `null` quand le mois précédent est à
 * zéro : il n'y a pas de base de comparaison, et « +∞ % » ne dirait rien.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Présent ou en retard : l'élève était là. */
export const isPresent = (status: string) => status === "PRESENT" || status === "LATE";

/** Lundi 0 h (UTC) de la semaine en cours. */
export function startOfWeek(now: Date): Date {
  const day = now.getUTCDay(); // 0 = dimanche
  const sinceMonday = day === 0 ? 6 : day - 1;
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - sinceMonday),
  );
}

/**
 * Taux de présence de chaque jour, du lundi au samedi. Un jour sans appel est
 * omis, pas compté à zéro : une journée sans cours ne doit pas faire plonger
 * la courbe — même règle que pour les mois sans appel.
 */
export function weeklyAttendance(
  records: { date: Date; status: string }[],
  weekStart: Date,
): { dayIndex: number; rate: number }[] {
  const days: { dayIndex: number; rate: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const from = weekStart.getTime() + i * DAY_MS;
    const to = from + DAY_MS;
    const ofDay = records.filter((r) => r.date.getTime() >= from && r.date.getTime() < to);
    if (ofDay.length === 0) continue;
    const present = ofDay.filter((r) => isPresent(r.status)).length;
    days.push({ dayIndex: i, rate: Math.round((present / ofDay.length) * 100) });
  }
  return days;
}

/** Taux de présence mois par mois, les mois sans appel omis. */
export function monthlyAttendance(
  records: { date: Date; status: string }[],
  months: MonthKey[],
): { month: MonthKey; rate: number }[] {
  return months.flatMap((key) => {
    const ofMonth = records.filter((r) => isInMonth(r.date, key));
    if (ofMonth.length === 0) return [];
    const present = ofMonth.filter((r) => isPresent(r.status)).length;
    return [{ month: key, rate: Math.round((present / ofMonth.length) * 100) }];
  });
}

/**
 * Jour de l'emploi du temps : 1 = lundi … 5 = vendredi, `null` le week-end.
 * Même convention que la saisie des créneaux.
 */
export function scheduleDay(now: Date): number | null {
  const day = now.getUTCDay();
  return day >= 1 && day <= 5 ? day : null;
}

/** 510 → "08:30" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** Clé de jour du calendrier, ex. "2026-09-13" (UTC). */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Les plus grandes parts, puis le reste regroupé sous `othersLabel` : au-delà
 * de `max` couleurs, un anneau de répartition devient illisible. Les parts
 * nulles sont écartées.
 */
export function topWithOthers(data: Share[], max: number, othersLabel: string): Share[] {
  const sorted = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= max) return sorted;
  const rest = sorted.slice(max - 1).reduce((sum, d) => sum + d.value, 0);
  return [...sorted.slice(0, max - 1), { label: othersLabel, value: rest }];
}
