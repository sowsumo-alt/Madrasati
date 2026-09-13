/**
 * Calculs de l'emploi du temps partagés par la page du directeur et les tests
 * (tests/schedule.test.ts). Toutes les dates sont lues en UTC, l'heure des
 * écoles (voir src/lib/format.ts).
 */

const DAY_MS = 86_400_000;

export interface TimeRange {
  startMinutes: number;
  endMinutes: number;
}

/**
 * Lignes de la grille hebdomadaire : les plages horaires distinctes des cours
 * affichés, dans l'ordre de la journée. La grille suit ainsi les horaires réels
 * de l'école — pause de midi comprise — sans qu'on ait à les déclarer.
 */
export function timeRows(slots: TimeRange[]): TimeRange[] {
  const rows = new Map<string, TimeRange>();
  for (const slot of slots) {
    const key = `${slot.startMinutes}-${slot.endMinutes}`;
    if (!rows.has(key)) {
      rows.set(key, { startMinutes: slot.startMinutes, endMinutes: slot.endMinutes });
    }
  }
  return [...rows.values()].sort(
    (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes,
  );
}

/** Les cinq jours de classe, du lundi `monday` au vendredi. */
export function schoolDays(monday: Date): Date[] {
  return Array.from({ length: 5 }, (_, i) => new Date(monday.getTime() + i * DAY_MS));
}

export function addWeeks(monday: Date, weeks: number): Date {
  return new Date(monday.getTime() + weeks * 7 * DAY_MS);
}

/** Jour de la semaine d'une date : 1 = lundi … 7 = dimanche (convention des créneaux). */
export function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Cases du calendrier d'un mois, en semaines commençant le lundi : les jours
 * du mois précédent et du suivant complètent la première et la dernière ligne.
 */
export function monthCells(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const first = Date.UTC(year, month, 1);
  const leading = (new Date(first).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const count = Math.ceil((leading + daysInMonth) / 7) * 7;
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(first + (i - leading) * DAY_MS);
    return { date, inMonth: date.getUTCMonth() === month };
  });
}
