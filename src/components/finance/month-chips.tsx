"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { monthLabel } from "@/lib/tuition";

const shortMonth = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" });

/**
 * Mois à cocher : ceux que le parent règle en même temps que l'inscription
 * (juin, le dernier mois, ou les premiers mois). Un mois coché est enregistré
 * comme payé, jamais compté dans les impayés.
 */
export function MonthChips({
  months,
  value,
  onChange,
}: {
  /** Mois proposés, ISO (premier jour du mois). */
  months: string[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const chosen = new Set(value);
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="month-chips">
      {months.map((m) => {
        const on = chosen.has(m);
        const date = new Date(m);
        return (
          <button
            key={m}
            type="button"
            title={monthLabel(date)}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== m) : [...value, m].sort())}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
              on
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-border bg-surface text-foreground/70 hover:bg-emerald-50",
            )}
            data-testid={`month-${m.slice(0, 7)}`}
          >
            {on && <Check className="h-3 w-3" strokeWidth={3} />}
            {shortMonth.format(date)}
          </button>
        );
      })}
    </div>
  );
}
