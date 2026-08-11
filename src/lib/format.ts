const mruFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

/** Formate un montant entier en Ouguiya mauritaine, ex: 15 000 MRU */
export function formatMRU(amount: number) {
  return `${mruFormatter.format(amount)} MRU`;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatDate(date: Date | string) {
  return dateFormatter.format(new Date(date));
}

const longDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Ex: 18 mai 2025 — utilisé dans les en-têtes de page. */
export function formatLongDate(date: Date | string) {
  return longDateFormatter.format(new Date(date));
}

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Horodatage court pour un fil d'activité : l'heure si c'est aujourd'hui,
 * « Hier », puis la date pour tout ce qui est plus ancien.
 */
export function formatEventTime(date: Date | string) {
  const d = new Date(date);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d >= startOfToday) return timeFormatter.format(d);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  if (d >= startOfYesterday) return "Hier";
  return formatDate(d);
}
