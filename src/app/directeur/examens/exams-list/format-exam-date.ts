import { formatDateIn } from "@/lib/format";
import { minutesToTime } from "@/lib/dashboard-data";

/** « 15/09/2026 08:00 », ou la date seule pour un examen planifié sans heure. */
export function formatExamDate(locale: string, iso: string, startMinutes: number | null) {
  const day = formatDateIn(locale, iso, { day: "2-digit", month: "2-digit", year: "numeric" });
  return startMinutes == null ? day : `${day} ${minutesToTime(startMinutes)}`;
}
