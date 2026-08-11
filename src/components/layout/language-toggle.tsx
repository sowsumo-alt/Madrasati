"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-provider";
import { LOCALE_LABELS, type Locale } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

const LOCALES: Locale[] = ["fr", "en", "ar"];

export function LanguageToggle() {
  const { locale, setLocale } = useLanguage();
  const router = useRouter();

  function choose(next: Locale) {
    setLocale(next);
    // Les pages rendues côté serveur lisent la langue dans le cookie :
    // il faut les redemander pour qu'elles arrivent traduites.
    router.refresh();
  }

  return (
    <div className="flex items-center rounded-full border border-border bg-surface p-0.5 text-xs font-medium">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          aria-label={l === "ar" ? "العربية" : l.toUpperCase()}
          aria-pressed={locale === l}
          className={cn(
            "rounded-full px-2.5 py-1 transition-colors",
            locale === l
              ? "bg-primary-700 text-white"
              : "text-foreground/50 hover:text-foreground",
          )}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
