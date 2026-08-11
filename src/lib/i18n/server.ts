import { cookies } from "next/headers";
import {
  dictionaries,
  RTL_LOCALES,
  type Locale,
  type TranslationKey,
} from "./dictionaries";

export const LOCALE_COOKIE = "madrasati-locale";

function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && value in dictionaries;
}

/**
 * Langue choisie, lue depuis le cookie.
 *
 * Le choix est stocké en cookie et non en localStorage : les pages rendues
 * côté serveur (tableau de bord, bulletins) doivent connaître la langue avant
 * d'envoyer le HTML, sinon la page s'afficherait d'abord en français puis
 * basculerait — un clignotement désagréable, surtout en connexion lente.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "fr";
}

export function isRtlLocale(locale: Locale) {
  return RTL_LOCALES.includes(locale);
}

/** Fonction de traduction utilisable dans un composant serveur. */
export async function getTranslations() {
  const locale = await getLocale();
  return {
    locale,
    isRtl: isRtlLocale(locale),
    t: (key: TranslationKey) =>
      dictionaries[locale][key] ?? dictionaries.fr[key] ?? key,
  };
}
