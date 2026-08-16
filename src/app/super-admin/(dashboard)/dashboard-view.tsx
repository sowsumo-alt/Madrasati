"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  History,
  Loader2,
} from "lucide-react";
import { formatMRU, formatDate } from "@/lib/format";
import {
  PLAN_LABELS,
  PLANS,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_LABELS,
  type Plan,
  type SubscriptionStatus,
} from "@/lib/plans";
import { changeSchoolPlan, changeSubscriptionStatus } from "./actions";
import { MarkPaidDialog } from "./mark-paid-dialog";
import { HistoryDialog } from "./history-dialog";

export interface SchoolRow {
  id: string;
  name: string;
  city: string | null;
  studentCount: number;
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  lastPaymentAt: string | null;
  nextDueAt: string | null;
  amountDue: number | null;
}

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  trial: "bg-sky-500/15 text-sky-300",
  active: "bg-emerald-500/15 text-emerald-300",
  past_due: "bg-amber-500/15 text-amber-300",
  restricted: "bg-orange-500/15 text-orange-300",
  suspended: "bg-red-500/15 text-red-300",
};

const FILTERS: Array<"all" | SubscriptionStatus> = ["all", ...SUBSCRIPTION_STATUSES];

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-white/50">
        <Icon className="h-4 w-4" strokeWidth={2} />
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-white">{value}</p>
    </div>
  );
}

export function SuperAdminDashboard({ schools }: { schools: SchoolRow[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<"all" | SubscriptionStatus>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<SchoolRow | null>(null);
  const [historyTarget, setHistoryTarget] = useState<SchoolRow | null>(null);

  const filtered = useMemo(
    () => (statusFilter === "all" ? schools : schools.filter((s) => s.subscriptionStatus === statusFilter)),
    [schools, statusFilter],
  );

  const stats = useMemo(() => {
    const monthlyRevenue = schools
      .filter((s) => s.subscriptionStatus === "active")
      .reduce((sum, s) => sum + (s.amountDue ?? 0), 0);
    const pastDue = schools.filter((s) => s.subscriptionStatus === "past_due").length;
    const trial = schools.filter((s) => s.subscriptionStatus === "trial").length;
    return { total: schools.length, monthlyRevenue, pastDue, trial };
  }, [schools]);

  async function handlePlanChange(schoolId: string, plan: string) {
    setBusyId(schoolId);
    try {
      await changeSchoolPlan(schoolId, plan);
      toast.success("Formule mise à jour.");
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleStatusChange(schoolId: string, status: string) {
    setBusyId(schoolId);
    try {
      await changeSubscriptionStatus(schoolId, status);
      toast.success("Statut mis à jour.");
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Écoles clientes</h1>
        <p className="mt-1 text-sm text-white/50">
          Formules, statut d&apos;abonnement et paiements de toutes les écoles inscrites.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Building2} label="Écoles clientes" value={String(stats.total)} />
        <StatCard icon={Banknote} label="Revenu mensuel actif" value={formatMRU(stats.monthlyRevenue)} />
        <StatCard icon={Clock} label="En retard de paiement" value={String(stats.pastDue)} />
        <StatCard icon={CheckCircle2} label="En période d'essai" value={String(stats.trial)} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === f
                ? "bg-white text-neutral-900"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            {f === "all" ? "Toutes" : SUBSCRIPTION_STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-white/40">
            Aucune école ne correspond à ce filtre.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs font-medium uppercase tracking-wide text-white/40">
                  <th className="px-5 py-3">École</th>
                  <th className="px-5 py-3">Élèves</th>
                  <th className="px-5 py-3">Formule</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3">Dernier paiement</th>
                  <th className="px-5 py-3">Prochaine échéance</th>
                  <th className="px-5 py-3">Dû ce mois</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.03]">
                    <td className="px-5 py-3">
                      <p className="font-medium text-white">{s.name}</p>
                      <p className="text-xs text-white/40">{s.city ?? "—"}</p>
                    </td>
                    <td className="px-5 py-3 text-white/70">{s.studentCount}</td>
                    <td className="px-5 py-3">
                      <select
                        value={s.plan}
                        disabled={busyId === s.id}
                        onChange={(e) => handlePlanChange(s.id, e.target.value)}
                        className="rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-white/40 focus:outline-none disabled:opacity-50"
                      >
                        {PLANS.map((p) => (
                          <option key={p} value={p} className="bg-neutral-900">
                            {PLAN_LABELS[p]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={s.subscriptionStatus}
                        disabled={busyId === s.id}
                        onChange={(e) => handleStatusChange(s.id, e.target.value)}
                        className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50 ${STATUS_STYLES[s.subscriptionStatus]}`}
                      >
                        {SUBSCRIPTION_STATUSES.map((st) => (
                          <option key={st} value={st} className="bg-neutral-900 text-white">
                            {SUBSCRIPTION_STATUS_LABELS[st]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3 text-white/60">
                      {s.lastPaymentAt ? formatDate(s.lastPaymentAt) : "—"}
                    </td>
                    <td className="px-5 py-3 text-white/60">
                      {s.nextDueAt ? formatDate(s.nextDueAt) : "—"}
                    </td>
                    <td className="px-5 py-3 text-white/60">
                      {s.amountDue != null ? formatMRU(s.amountDue) : "Sur devis"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {busyId === s.id && <Loader2 className="h-4 w-4 animate-spin text-white/40" />}
                        <button
                          onClick={() => setPayTarget(s)}
                          className="flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                        >
                          <Banknote className="h-3.5 w-3.5" />
                          Marquer payé
                        </button>
                        <button
                          onClick={() => setHistoryTarget(s)}
                          title="Historique des paiements"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                        >
                          <History className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MarkPaidDialog
        target={payTarget ? { id: payTarget.id, name: payTarget.name, amountDue: payTarget.amountDue } : null}
        onOpenChange={(open) => !open && setPayTarget(null)}
      />
      <HistoryDialog
        target={historyTarget ? { id: historyTarget.id, name: historyTarget.name } : null}
        onOpenChange={(open) => !open && setHistoryTarget(null)}
      />
    </div>
  );
}
