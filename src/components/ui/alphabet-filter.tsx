"use client";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-provider";
import { LETTERS, initialsOf } from "@/lib/initials";

// Logique des lettres partagée avec le serveur (listes paginées côté serveur).
export { initialsOf, matchesLetter } from "@/lib/initials";

export function AlphabetFilter({
  names,
  value,
  onChange,
  className,
}: {
  /** Noms complets de la liste entière : sert à griser les lettres sans résultat. */
  names: string[];
  value: string | null;
  onChange: (letter: string | null) => void;
  className?: string;
}) {
  const { t } = useLanguage();
  const available = new Set(names.flatMap(initialsOf));

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1", className)}
      role="group"
      aria-label={t("search.byLetter")}
    >
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        className={cn(
          "h-8 rounded-md px-2.5 text-xs font-medium transition-colors",
          value === null
            ? "bg-primary-700 text-white"
            : "text-foreground/60 hover:bg-surface-muted",
        )}
      >
        {t("common.all")}
      </button>
      {LETTERS.map((letter) => {
        const enabled = available.has(letter);
        const active = value === letter;
        return (
          <button
            key={letter}
            type="button"
            disabled={!enabled}
            // Un second clic sur la lettre active la retire : c'est le geste
            // attendu, et il évite d'avoir à viser « Tous » pour revenir.
            onClick={() => onChange(active ? null : letter)}
            aria-pressed={active}
            className={cn(
              "h-8 w-8 rounded-md text-xs font-medium tabular-nums transition-colors",
              active && "bg-primary-700 text-white",
              !active && enabled && "text-foreground/70 hover:bg-surface-muted",
              !enabled && "cursor-default text-foreground/20",
            )}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}
