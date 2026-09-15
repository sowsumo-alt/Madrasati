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

/** Ex: 08:42 — l'heure de l'école. */
export function formatTime(date: Date | string) {
  return timeFormatter.format(new Date(date));
}

/**
 * Date dans la langue de l'interface (fr, en ou ar), au fuseau des écoles. En
 * arabe, les chiffres restent latins (u-nu-latn), comme sur tout le reste de
 * l'application.
 */
export function formatDateIn(
  locale: string,
  date: Date | string,
  options: Intl.DateTimeFormatOptions,
) {
  const tag = locale === "ar" ? "ar-u-nu-latn" : locale;
  return new Intl.DateTimeFormat(tag, { ...options, timeZone: TIME_ZONE }).format(new Date(date));
}

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

/**
 * Numéro lisible : « +222 46 52 38 96 » plutôt que « +22246523896 ».
 * Un numéro mauritanien tient en huit chiffres après l'indicatif ; tout
 * autre format est rendu tel quel, sans rien inventer.
 */
export function formatPhone(phone: string): string {
  const compact = phone.replace(/\s/g, "");
  const local = compact.startsWith("+222") ? compact.slice(4) : null;
  if (!local || !/^\d{8}$/.test(local)) return phone;
  return `+222 ${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6)}`;
}
