"use client";

import { useState } from "react";
import { BarChart3, Coins, TrendingDown, TrendingUp } from "lucide-react";
import { AreaChart } from "@/components/charts/area-chart";
import { niceMax } from "@/components/charts/chart-primitives";
import { useSaTheme } from "@/components/super-admin/sa-shell";
import { formatMRU } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardData } from "./types";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

/**
 * Revenus encaissés par mois (abonnements réellement payés, enregistrés via
 * « Enregistrer un paiement »), sur 6 ou 12 mois, avec le total de la période
 * et son évolution, ce qui est encaissé ce mois-ci et ce que rapportent les
 * écoles actives chaque mois.
 */
export function RevenueCard({ revenue }: { revenue: DashboardData["revenue"] }) {
  const theme = useSaTheme();
  const [months, setMonths] = useState<6 | 12>(6);
  const period = revenue.periods[months];
  // Au moins 1 000 : sans paiement, l'axe reste lisible (0, 250, 500…) au lieu de 0 et 1.
  const max = niceMax(Math.max(...period.points.map((p) => p.value), 1000));
  const change = period.change;

  return (
    <section id="revenus" className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-soft sm:p-5" data-testid="sa-revenue">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-base font-semibold text-foreground">
          <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          Revenus encaissés par mois (MRU)
        </h2>
        <select
          value={months}
          onChange={(e) => setMonths(Number(e.target.value) as 6 | 12)}
          className="h-9 rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          aria-label="Période"
          data-testid="sa-revenue-period"
        >
          <option value={6}>6 derniers mois</option>
          <option value={12}>12 derniers mois</option>
        </select>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_13rem] md:gap-0">
        <div className="min-w-0 md:pe-5">
          <AreaChart
            data={period.points}
            max={max}
            color={theme === "dark" ? "#34d399" : "#0f7049"}
            theme={theme}
            tickFormat={fmt}
            emptyLabel="Aucun paiement enregistré."
          />
        </div>
        <div className="flex flex-col justify-center gap-4 border-border md:border-s md:ps-5">
          <div>
            <p className="text-sm text-foreground/60">Total encaissé</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground" style={{ fontVariantNumeric: "tabular-nums" }} data-testid="sa-revenue-total">
              {formatMRU(period.total)}
            </p>
            <p
              className={cn(
                "mt-1 flex items-center gap-1 text-xs font-medium",
                change == null ? "text-foreground/50" : change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
              )}
            >
              {change != null && (change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />)}
              {change == null ? "Pas de période précédente à comparer" : `${change >= 0 ? "+" : ""}${change} % vs ${months} mois précédents`}
            </p>
          </div>
          <div className="flex items-center gap-3 border-t border-border pt-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
              <Coins className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-xs text-foreground/60">Ce mois-ci</span>
              <span className="block text-sm font-semibold text-foreground">{formatMRU(revenue.thisMonth)}</span>
            </span>
          </div>
          <p className="text-xs text-foreground/55">
            Attendu chaque mois (écoles actives) : <span className="font-semibold text-foreground/80">{formatMRU(revenue.expectedMonthly)}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
