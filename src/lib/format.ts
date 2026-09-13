const mruFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

/** Formate un montant entier en Ouguiya mauritaine, ex: 15 000 MRU */
export function formatMRU(amount: number) {
  return `${mruFormatter.format(amount)} MRU`;
}

/** Même séparateur de milliers que formatMRU, sans le suffixe "MRU" — pour
 *  les modèles de message qui l'ajoutent déjà eux-mêmes (ex: "{amount} MRU"). */
export function formatAmount(amount: number) {
  return mruFormatter.format(amount);
}

/**
 * Fuseau des écoles : la Mauritanie, en UTC toute l'année (pas d'heure d'été).
 *
 * Fixé plutôt que laissé à l'appareil : le serveur tourne en UTC, et un
 * navigateur réglé sur un autre fuseau écrivait la même date autrement —
 * « 31 août 2026 » d'un côté, « 01 sept. 2026 » de l'autre. React voyait la
 * différence et devait refaire la page (erreur #418 sur Paramètres).
 */
const TIME_ZONE = "Africa/Nouakchott";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});

export function formatDate(date: Date | string) {
  return dateFormatter.format(new Date(date));
}

const longDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});

/** Ex: 18 mai 2025 — utilisé dans les en-têtes de page. */
export function formatLongDate(date: Date | string) {
  return longDateFormatter.format(new Date(date));
}

const longDateFormatterAr = new Intl.DateTimeFormat("ar", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});

/**
 * Ex: 18 مايو 2025 — nom du mois en arabe standard, chiffres latins (comme
 * l'écrivent naturellement les parents en Mauritanie). Utilisé dans le bloc
 * arabe des messages WhatsApp bilingues, jamais la date française copiée
 * telle quelle.
 */
export function formatLongDateAr(date: Date | string) {
  return longDateFormatterAr.format(new Date(date));
}

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

/**
 * Horodatage court pour un fil d'activité : l'heure si c'est aujourd'hui,
 * « Hier », puis la date pour tout ce qui est plus ancien.
 */
export function formatEventTime(date: Date | string) {
  const d = new Date(date);
  const now = new Date();
  // Minuit à Nouakchott, c'est-à-dire minuit UTC (voir TIME_ZONE).
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (d >= startOfToday) return timeFormatter.format(d);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setUTCDate(startOfYesterday.getUTCDate() - 1);
  if (d >= startOfYesterday) return "Hier";
  return formatDate(d);
}
