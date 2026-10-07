import { monthsBetween } from "@/lib/tuition";

/**
 * La période d'un rapport : toute l'année scolaire, ou un mois (« 2026-10 »)
 * de cette année. Un mois hors de l'année est ignoré.
 */
export function reportPeriod(
  year: { startDate: Date; endDate: Date },
  month: string | null | undefined,
): { from: Date; to: Date; month: string | null; months: Date[] } {
  const months = monthsBetween(year.startDate, year.endDate);
  const chosen = month ? months.find((m) => m.toISOString().slice(0, 7) === month) : undefined;
  if (chosen) {
    return { from: chosen, to: new Date(Date.UTC(chosen.getUTCFullYear(), chosen.getUTCMonth() + 1, 1)), month: month!, months };
  }
  const last = months[months.length - 1] ?? year.endDate;
  return {
    from: months[0] ?? year.startDate,
    to: new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 1)),
    month: null,
    months,
  };
}
