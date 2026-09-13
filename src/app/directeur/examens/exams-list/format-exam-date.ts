import { formatDateIn } from "@/lib/format";
import { minutesToTime } from "@/lib/dashboard-data";

/** « 15/09/2026 08:00 », ou la date seule pour un examen planifié sans heure. */
export function formatExamDate(locale: string, iso: string, startMinutes: number | null) {
  // L'arabe glisse des marques de direction entre jour, mois et année : dans un
  // span dir="ltr" elles mélangent la date et l'heure (« 1508:00 2026/09/ »).
  const day = formatDateIn(locale, iso, { day: "2-digit", month: "2-digit", year: "numeric" }).replace(
    /\p{Cf}/gu,
    "",
  );
  return startMinutes == null ? day : `${day} ${minutesToTime(startMinutes)}`;
}
