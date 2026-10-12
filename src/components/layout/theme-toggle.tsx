"use client";

import { Moon, Sun } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { AppTheme } from "@/lib/app-theme";

/** Bouton soleil/lune : passe du thème clair au sombre et inversement. */
export function ThemeToggle({ theme, onToggle }: { theme: AppTheme; onToggle: () => void }) {
  const { t } = useLanguage();
  const label = theme === "dark" ? t("header.themeLight") : t("header.themeDark");
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground/70 transition-colors hover:bg-surface-muted hover:text-foreground"
      data-testid="theme-toggle"
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
