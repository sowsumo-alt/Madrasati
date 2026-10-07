import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/charts/sparkline";
import { cn } from "@/lib/utils";

export type KpiTone = "emerald" | "blue" | "amber" | "rose" | "violet";

// Une teinte par indicateur, comme sur la maquette : pastille d'icône et
// mini-courbe. La valeur reste écrite en toutes lettres — la couleur ne
// porte jamais seule le sens.
const TONES: Record<KpiTone, { badge: string; line: string }> = {
  emerald: { badge: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300", line: "#10b981" },
  blue: { badge: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300", line: "#3b82f6" },
  amber: { badge: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300", line: "#f59e0b" },
  rose: { badge: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300", line: "#f43f5e" },
  violet: { badge: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300", line: "#8b5cf6" },
};

/** Tuile d'indicateur : pastille, libellé, valeur, précision et mini-courbe de tendance. */
export function KpiTile({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  hintTone = "neutral",
  trend,
}: {
  icon: LucideIcon;
  tone: KpiTone;
  label: string;
  value: string;
  hint: string;
  hintTone?: "up" | "down" | "neutral";
  trend?: number[];
}) {
  const t = TONES[tone];
  return (
    <div className="relative flex min-w-0 gap-3.5 rounded-2xl border border-border bg-surface p-4 shadow-soft" data-testid="sa-kpi">
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", t.badge)}>
        <Icon className="h-6 w-6" strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground/80">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
          {value}
        </p>
        <p
          className={cn(
            "mt-1 flex items-center gap-1 text-xs",
            hintTone === "up" ? "font-medium text-emerald-600 dark:text-emerald-400" : hintTone === "down" ? "font-medium text-rose-600 dark:text-rose-400" : "text-foreground/55",
          )}
        >
          {hintTone === "up" && <TrendingUp className="h-3.5 w-3.5" />}
          {hintTone === "down" && <TrendingDown className="h-3.5 w-3.5" />}
          {hint}
        </p>
      </div>
      {trend && trend.length > 1 && (
        <Sparkline values={trend} color={t.line} className="absolute end-4 top-[2.85rem] h-7 w-16 opacity-90" />
      )}
    </div>
  );
}
