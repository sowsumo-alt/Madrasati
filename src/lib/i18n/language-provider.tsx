"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  dictionaries,
  RTL_LOCALES,
  type Locale,
  type TranslationKey,
} from "./dictionaries";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const COOKIE_NAME = "madrasati-locale";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function LanguageProvider({
  children,
  initialLocale = "fr",
}: {
  children: ReactNode;
  /** Langue lue du cookie côté serveur : évite tout clignotement au chargement. */
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const isRtl = RTL_LOCALES.includes(locale);

  /**
   * L'arabe s'écrit de droite à gauche. On pose `dir` et `lang` sur <html> :
   * le navigateur inverse alors seul l'ordre des éléments flex et grid, la
   * direction du texte et les barres de défilement, et les correctifs CSS de
   * globals.css s'accrochent à [dir="rtl"].
   */
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
  }, [locale]);

  function setLocale(next: Locale) {
    setLocaleState(next);
    // Cookie plutôt que localStorage : le serveur doit pouvoir lire la langue
    // pour rendre les pages directement dans la bonne.
    document.cookie = `${COOKIE_NAME}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
  }

  function t(key: TranslationKey) {
    return dictionaries[locale][key] ?? dictionaries.fr[key] ?? key;
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, isRtl }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
