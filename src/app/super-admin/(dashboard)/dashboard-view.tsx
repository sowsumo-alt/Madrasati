import { Suspense } from "react";
import { Building2, Clock, Coins, PlusSquare, Power } from "lucide-react";
import { formatAmount } from "@/lib/format";
import { DashboardHeader } from "./sections/dashboard-header";
import { KpiTile } from "./sections/kpi-tile";
import { RevenueCard } from "./sections/revenue-card";
import { QuickActions } from "./sections/quick-actions";
import { TrialsAlert } from "./sections/trials-alert";
import { SchoolsSection } from "./sections/schools-section";
import { RecentActivity } from "./sections/recent-activity";
import type { DashboardData } from "./sections/types";

/**
 * Tableau de bord Super Admin (maquette « mode sombre ») : en-tête, cinq
 * indicateurs, revenus encaissés et actions rapides, puis les écoles
 * clientes et l'activité récente. Chaque bloc est un composant de sections/.
 */
export function SuperAdminDashboard({ data }: { data: DashboardData }) {
  const { kpis } = data;
  return (
    <div className="space-y-5">
      <DashboardHeader todayLabel={data.todayLabel} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <KpiTile
          icon={Building2}
          tone="emerald"
          label="Écoles clientes"
          value={String(kpis.totalSchools)}
          hint={`${kpis.newThisWeek > 0 ? "+" : ""}${kpis.newThisWeek} cette semaine`}
          hintTone={kpis.newThisWeek > 0 ? "up" : "neutral"}
          trend={kpis.schoolsTrend}
        />
        <KpiTile
          icon={PlusSquare}
          tone="blue"
          label="Nouvelles écoles"
          value={String(kpis.newThisMonth)}
          hint={`ce mois-ci · ${kpis.newThisWeek} cette semaine`}
          trend={kpis.newTrend}
        />
        <KpiTile
          icon={Coins}
          tone="amber"
          label="Revenu mensuel (MRU)"
          value={formatAmount(kpis.revenueThisMonth)}
          hint={
            kpis.revenueChange == null
              ? "encaissé ce mois-ci"
              : `${kpis.revenueChange >= 0 ? "+" : ""}${kpis.revenueChange} % vs mois précédent`
          }
          hintTone={kpis.revenueChange == null ? "neutral" : kpis.revenueChange >= 0 ? "up" : "down"}
          trend={kpis.revenueTrend}
        />
        <KpiTile
          icon={Clock}
          tone="rose"
          label="Retard de paiement"
          value={String(kpis.late)}
          hint={kpis.late === 0 ? "Aucun retard" : kpis.maxDaysLate ? `jusqu'à ${kpis.maxDaysLate} jours` : "à relancer"}
          hintTone={kpis.late > 0 ? "down" : "neutral"}
        />
        <KpiTile
          icon={Power}
          tone="violet"
          label="En attente d'activation"
          value={String(kpis.pending)}
          hint={kpis.pending === 0 ? "Aucune en attente" : "à activer"}
        />
      </div>

      {/* Deux colonnes dès 1 660 px (la largeur de la maquette), chacune empilée
          à sa façon. En dessous, une seule colonne : les revenus, les actions
          rapides, les écoles, puis l'activité (les colonnes s'effacent,
          « contents », et chaque bloc prend sa place dans l'ordre). */}
      <div className="flex flex-col gap-5 min-[1660px]:grid min-[1660px]:grid-cols-[minmax(0,1fr)_19.5rem] min-[1660px]:items-start">
        <div className="contents min-[1660px]:block min-[1660px]:min-w-0 min-[1660px]:space-y-5">
          <div className="order-1 min-w-0">
            <RevenueCard revenue={data.revenue} />
          </div>
          <div className="order-3 min-w-0 space-y-5">
            <TrialsAlert schools={data.schools} />
            <Suspense>
              <SchoolsSection schools={data.schools} />
            </Suspense>
          </div>
        </div>
        <div className="contents min-[1660px]:block min-[1660px]:space-y-5">
          <div className="order-2">
            <QuickActions schools={data.schools} />
          </div>
          <div className="order-4">
            <RecentActivity items={data.activity} />
          </div>
        </div>
      </div>
    </div>
  );
}
