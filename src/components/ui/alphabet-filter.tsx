"use client";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-provider";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/**
 * Première lettre d'un mot, sans accent et en majuscule : « Aïcha » et
 * « Ahmed » tombent tous les deux sous A, « Élève » sous E.
 */
function normalizeLetter(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .slice(0, 1);
}

/**
 * Lettres sous lesquelles une personne doit apparaître : l'initiale de
 * *chacun* de ses noms, pas seulement celle du nom de famille.
 *
 * C'est délibéré pour la Mauritanie : avec les particules « Ould » et
 * « Mint », classer sur le seul nom de famille entasserait la moitié de
 * l'école sous O et M, et un directeur qui cherche « Fatimetou Mint Salem »
 * sous S ne la trouverait pas. Ici elle répond à F, à M et à S — la
 * recherche ne cache jamais quelqu'un parce qu'on a pensé à lui sous un
 * autre de ses noms.
 */
export function initialsOf(fullName: string): string[] {
  return [
    ...new Set(
      fullName
        .split(/[\s'’-]+/)
        .filter(Boolean)
        .map(normalizeLetter)
        .filter((l) => LETTERS.includes(l)),
    ),
  ];
}

/** Le nom correspond-il à la lettre choisie ? `letter` nul = aucun filtre. */
export function matchesLetter(fullName: string, letter: string | null) {
  return !letter || initialsOf(fullName).includes(letter);
}

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
