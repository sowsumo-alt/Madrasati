import { UserRound } from "lucide-react";
import { SERIE, SERIE_2 } from "@/components/charts/chart-primitives";
import { cn } from "@/lib/utils";

function Side({
  label,
  count,
  percent,
  tone,
  align = "start",
}: {
  label: string;
  count: number;
  percent: number;
  tone: "boys" | "girls";
  align?: "start" | "end";
}) {
  return (
    <div className={cn("flex shrink-0 items-center gap-3", align === "end" && "sm:flex-row-reverse sm:text-end")}>
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        style={{ background: `${tone === "boys" ? SERIE : SERIE_2}1a`, color: tone === "boys" ? SERIE : SERIE_2 }}
      >
        <UserRound className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-xs text-foreground/55">{label}</span>
        <span className="block text-base font-semibold text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
          {count} <span className="text-sm font-normal text-foreground/55">({percent}%)</span>
        </span>
      </span>
    </div>
  );
}

/**
 * Garçons et filles, de part et d'autre d'une barre partagée. Le vert et l'or
 * sont la paire validée des graphiques (chart-primitives) ; les deux effectifs
 * restent écrits, la couleur n'est jamais seule à les distinguer.
 */
export function GenderSplit({
  boys,
  girls,
  unknown,
  boysLabel,
  girlsLabel,
  unknownLabel,
  emptyLabel,
}: {
  boys: number;
  girls: number;
  unknown: number;
  boysLabel: string;
  girlsLabel: string;
  unknownLabel: string;
  emptyLabel: string;
}) {
  const known = boys + girls;
  if (known + unknown === 0) {
    return <p className="py-6 text-center text-xs text-foreground/40">{emptyLabel}</p>;
  }
  const boysPercent = known === 0 ? 0 : Math.round((boys / known) * 100);
  const girlsPercent = known === 0 ? 0 : 100 - boysPercent;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <Side label={boysLabel} count={boys} percent={boysPercent} tone="boys" />
        <div
          className="flex h-3 flex-1 gap-[2px] overflow-hidden rounded-full bg-surface-muted"
          role="img"
          aria-label={`${boysLabel} ${boys} (${boysPercent}%), ${girlsLabel} ${girls} (${girlsPercent}%)`}
        >
          {boys > 0 && <span className="h-full" style={{ width: `${boysPercent}%`, background: SERIE }} />}
          {girls > 0 && <span className="h-full" style={{ width: `${girlsPercent}%`, background: SERIE_2 }} />}
        </div>
        <Side label={girlsLabel} count={girls} percent={girlsPercent} tone="girls" align="end" />
      </div>
      {unknown > 0 && <p className="mt-3 text-xs text-foreground/50">{unknownLabel}</p>}
    </div>
  );
}
