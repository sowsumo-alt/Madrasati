import { subjectStyle } from "@/components/subjects/subject-style";
import { cn } from "@/lib/utils";

/**
 * Moyenne de chaque matière sur 20. La couleur est celle de la matière sur
 * l'emploi du temps — elle dit de quelle matière il s'agit, pas si la moyenne
 * est bonne — et chaque barre porte son nom et sa valeur en toutes lettres.
 */
export function SubjectAverageList({
  data,
  emptyLabel,
}: {
  data: { label: string; value: number }[];
  emptyLabel: string;
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-xs text-foreground/40">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-3">
      {data.map((d) => {
        const style = subjectStyle(d.label);
        const Icon = style.icon;
        return (
          <li key={d.label} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", style.badge)}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="truncate text-sm text-foreground/80" title={d.label}>
                {d.label}
              </span>
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
              <span
                className={cn("block h-full rounded-full", style.bar)}
                style={{ width: `${Math.max(0, Math.min(100, (d.value / 20) * 100))}%` }}
              />
            </span>
            <span
              className="w-10 text-end text-sm font-semibold text-foreground"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {d.value.toFixed(1)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
