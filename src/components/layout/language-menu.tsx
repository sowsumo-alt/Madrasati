"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { Locale } from "@/lib/i18n/dictionaries";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LANGUAGES: { locale: Locale; code: string; name: string }[] = [
  { locale: "fr", code: "FR", name: "Français" },
  { locale: "en", code: "EN", name: "English" },
  { locale: "ar", code: "AR", name: "العربية" },
];

/**
 * Petits drapeaux dessinés en SVG : les émojis drapeaux ne s'affichent pas
 * sous Windows, où ils deviennent deux simples lettres.
 */
function Flag({ locale }: { locale: Locale }) {
  const className = "h-3.5 w-5 shrink-0 rounded-[3px] ring-1 ring-black/10";
  if (locale === "fr") {
    return (
      <svg viewBox="0 0 3 2" className={className} aria-hidden>
        <rect width="1" height="2" fill="#0055a4" />
        <rect x="1" width="1" height="2" fill="#ffffff" />
        <rect x="2" width="1" height="2" fill="#ef4135" />
      </svg>
    );
  }
  if (locale === "en") {
    return (
      <svg viewBox="0 0 60 40" className={className} aria-hidden>
        <rect width="60" height="40" fill="#012169" />
        <path d="M0,0 L60,40 M60,0 L0,40" stroke="#ffffff" strokeWidth="8" />
        <path d="M0,0 L60,40 M60,0 L0,40" stroke="#c8102e" strokeWidth="3" />
        <path d="M30,0 V40 M0,20 H60" stroke="#ffffff" strokeWidth="12" />
        <path d="M30,0 V40 M0,20 H60" stroke="#c8102e" strokeWidth="7" />
      </svg>
    );
  }
  // Arabe : le drapeau de la Mauritanie, pays des écoles Madrasati.
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden>
      <rect width="30" height="20" fill="#d01c1f" />
      <rect y="3" width="30" height="14" fill="#00a95c" />
      <path d="M9.5,8 a5.5,5.5 0 0 0 11,0 a5.5,4.2 0 0 1 -11,0 Z" fill="#ffd700" />
      <path
        d="M15,4.4 l0.55,1.7 h1.8 l-1.45,1.05 0.55,1.7 -1.45,-1.05 -1.45,1.05 0.55,-1.7 -1.45,-1.05 h1.8 Z"
        fill="#ffd700"
      />
    </svg>
  );
}

/** Choix de la langue, en menu déroulant avec drapeau (en-tête de l'application). */
export function LanguageMenu() {
  const { locale, setLocale, t } = useLanguage();
  const router = useRouter();
  const current = LANGUAGES.find((l) => l.locale === locale) ?? LANGUAGES[0];

  function choose(next: Locale) {
    if (next === locale) return;
    setLocale(next);
    // Les pages rendues côté serveur lisent la langue dans le cookie :
    // il faut les redemander pour qu'elles arrivent traduites.
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("header.language")}
        className="flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <Flag locale={current.locale} />
        {current.code}
        <ChevronDown className="h-4 w-4 text-foreground/50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[11rem]">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem key={l.locale} onSelect={() => choose(l.locale)}>
            <Flag locale={l.locale} />
            <span className="flex-1">{l.name}</span>
            {l.locale === locale && <Check className="h-4 w-4 text-primary-600" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
