import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLASS_FILTERS, isClassFilter, type ClassFilter } from "@/lib/classes-list";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

/** Recherche et filtre de la liste des classes. */
export function ClassesToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  filter: ClassFilter;
  onFilterChange: (value: ClassFilter) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative sm:w-full sm:max-w-[24rem]">
        <Search className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-primary-600" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("classes.searchPlaceholder")}
          aria-label={t("classes.searchPlaceholder")}
          className="h-10.5 w-full rounded-xl border border-border/60 bg-surface pe-4 ps-11 text-sm text-foreground transition-colors placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        />
      </div>
      <Select
        value={filter}
        onValueChange={(value) => {
          // Radix renvoie parfois une valeur vide en se refermant.
          if (isClassFilter(value)) onFilterChange(value);
        }}
      >
        <SelectTrigger
          aria-label={t("classes.filter.ALL")}
          className="h-10.5 rounded-xl border-border/60 bg-surface px-4 text-sm text-primary-900/80 sm:w-56"
        >
          {/* Libellé rendu par nous : Radix ne l'affiche qu'une fois la page
              chargée, le filtre paraissait vide jusque-là. */}
          <SelectValue>{t(`classes.filter.${filter}` as TranslationKey)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {CLASS_FILTERS.map((f) => (
            <SelectItem key={f} value={f}>
              {t(`classes.filter.${f}` as TranslationKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
