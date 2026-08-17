"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  History,
  Loader2,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { formatMRU, formatDate } from "@/lib/format";
import {
  PLAN_LABELS,
  PLANS,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_LABELS,
  isOwingStatus,
  type Plan,
  type SubscriptionStatus,
} from "@/lib/plans";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { LineChart, type Point } from "@/components/charts/chart-primitives";
import { changeSchoolPlan, changeSubscriptionStatus } from "./actions";
import { MarkPaidDialog } from "./mark-paid-dialog";
import { HistoryDialog } from "./history-dialog";
import { buildReminderMessage, reminderButtonTitle } from "./reminder-message";

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
  directorName: string | null;
  directorPhone: string | null;
  createdAt: string;
  daysLate: number | null;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
}

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  trial: "bg-sky-500/15 text-sky-300",
  active: "bg-emerald-500/15 text-emerald-300",
  past_due: "bg-amber-500/15 text-amber-300",
  restricted: "bg-orange-500/15 text-orange-300",
  suspended: "bg-red-500/15 text-red-300",
};

const FILTERS: Array<"all" | SubscriptionStatus> = ["all", ...SUBSCRIPTION_STATUSES];

/**
 * La couleur du retard s'intensifie avec sa durée : un jour de décalage n'a
 * pas à crier aussi fort qu'un impayé de trois semaines, et c'est ce dégradé
 * qui permet de trier les relances d'un coup d'œil sans lire les dates.
 */
function delayStyle(daysLate: number) {
  if (daysLate <= 7) return "bg-amber-500/15 text-amber-300";
  if (daysLate <= 14) return "bg-orange-500/25 text-orange-200";
  return "bg-red-500/25 text-red-200";
}

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

export function SuperAdminDashboard({
  schools,
  revenueByMonth,
  newThisMonth,
}: {
  schools: SchoolRow[];
  revenueByMonth: Point[];
  newThisMonth: number;
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<"all" | SubscriptionStatus>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<SchoolRow | null>(null);
  const [historyTarget, setHistoryTarget] = useState<SchoolRow | null>(null);
  const [isExporting, setIsExporting] = useState(false);

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

  /** Exporte ce que le tableau affiche réellement — filtre compris, pour que
   *  le fichier corresponde toujours à ce que le Super Admin a sous les yeux. */
  async function handleExport() {
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows = filtered.map((s) => ({
        "École": s.name,
        Ville: s.city ?? "",
        Directeur: s.directorName ?? "",
        Téléphone: s.directorPhone ?? "",
        "Élèves actifs": s.studentCount,
        Formule: PLAN_LABELS[s.plan],
        Statut: SUBSCRIPTION_STATUS_LABELS[s.subscriptionStatus],
        "Jours de retard": s.daysLate ?? 0,
        "Dernier paiement": s.lastPaymentAt ? formatDate(s.lastPaymentAt) : "",
        "Prochaine échéance": s.nextDueAt ? formatDate(s.nextDueAt) : "",
        "Dû ce mois (MRU)": s.amountDue ?? "Sur devis",
        "Inscrite le": formatDate(s.createdAt),
      }));

      const sheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Écoles clientes");
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `ecoles-madrasati-${today}.xlsx`);
      toast.success(`${rows.length} école(s) exportée(s).`);
    } catch {
      toast.error("L'export a échoué.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Écoles clientes</h1>
          <p className="mt-1 text-sm text-white/50">
            Formules, statut d&apos;abonnement et paiements de toutes les écoles inscrites.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting || filtered.length === 0}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Exporter en Excel
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Building2} label="Écoles clientes" value={String(stats.total)} />
        <StatCard icon={Sparkles} label="Nouvelles ce mois-ci" value={String(newThisMonth)} />
        <StatCard icon={Banknote} label="Revenu mensuel actif" value={formatMRU(stats.monthlyRevenue)} />
        <StatCard icon={Clock} label="En retard de paiement" value={String(stats.pastDue)} />
        <StatCard icon={CheckCircle2} label="En période d'essai" value={String(stats.trial)} />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-white/50">
          Revenu encaissé par mois (MRU)
        </p>
        <p className="mt-1 text-xs text-white/30">
          Abonnements réellement encaissés, d&apos;après les paiements enregistrés
          via « Marquer payé ».
        </p>
        <div className="mt-3">
          <LineChart data={revenueByMonth} theme="dark" />
        </div>
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
                  <th className="px-5 py-3">Directeur</th>
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
                {filtered.map((s) => {
                  const contactTitle = s.directorName
                    ? `${s.directorName}${s.directorPhone ? ` — ${s.directorPhone}` : " — téléphone non renseigné"}`
                    : "Aucun directeur enregistré";

                  return (
                    <tr key={s.id} className="hover:bg-white/[0.03]">
                      <td className="px-5 py-3">
                        <p className="font-medium text-white" title={contactTitle}>
                          {s.name}
                        </p>
                        <p className="text-xs text-white/40">{s.city ?? "—"}</p>
                      </td>
                      <td className="px-5 py-3">
                        {s.directorName ? (
                          <>
                            <p className="text-white/70">{s.directorName}</p>
                            <p className="text-xs text-white/40">{s.directorPhone ?? "—"}</p>
                          </>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
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
                        <div className="flex flex-wrap items-center gap-1.5">
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
                          {s.daysLate != null ? (
                            <span
                              title={`Échéance dépassée depuis ${s.daysLate} jour(s)`}
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${delayStyle(s.daysLate)}`}
                            >
                              {s.daysLate} j
                            </span>
                          ) : (
                            /* Marquée comme devant de l'argent, mais sans retard
                               calculable : l'échéance est à venir ou absente. Le
                               signaler vaut mieux que de laisser la case vide,
                               qui se lirait à tort comme « à jour ». */
                            isOwingStatus(s.subscriptionStatus) && (
                              <span
                                title={
                                  s.nextDueAt
                                    ? `Statut « ${SUBSCRIPTION_STATUS_LABELS[s.subscriptionStatus]} » alors que l'échéance du ${formatDate(s.nextDueAt)} n'est pas encore dépassée — vérifiez la date.`
                                    : "Aucune date d'échéance enregistrée : le retard ne peut pas être calculé. Utilisez « Marquer payé » pour en fixer une."
                                }
                                className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/50"
                              >
                                échéance ?
                              </span>
                            )
                          )}
                        </div>
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
                          {s.directorPhone ? (
                            <a
                              href={buildWhatsAppUrl(
                                s.directorPhone,
                                buildReminderMessage({
                                  schoolName: s.name,
                                  directorName: s.directorName,
                                  status: s.subscriptionStatus,
                                  amountDue: s.amountDue,
                                  daysLate: s.daysLate,
                                  nextDueAt: s.nextDueAt,
                                  trialEndsAt: s.trialEndsAt,
                                  trialDaysLeft: s.trialDaysLeft,
                                }),
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={reminderButtonTitle(s.subscriptionStatus)}
                              aria-label={reminderButtonTitle(s.subscriptionStatus)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-300/80 transition-all duration-150 hover:bg-emerald-500/15 hover:text-emerald-200 active:scale-90"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          ) : (
                            <span
                              title="Aucun numéro de téléphone enregistré pour cette école"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/15"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </span>
                          )}
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
                  );
                })}
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
