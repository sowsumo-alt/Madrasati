"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Banknote, Building2, ChevronDown, Download, Eye, History, Loader2, MessageCircle, MoreVertical, Pencil, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate, formatMRU } from "@/lib/format";
import {
  PLAN_LABELS,
  PLANS,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_LABELS,
  isOwingStatus,
  isSubscriptionStatus,
  type SubscriptionStatus,
} from "@/lib/plans";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { changeSchoolPlan, changeSubscriptionStatus } from "../actions";
import { MarkPaidDialog } from "../mark-paid-dialog";
import { HistoryDialog } from "../history-dialog";
import { buildReminderMessage, reminderButtonTitle } from "../reminder-message";
import { exportSchools } from "./export-schools";
import type { SchoolRow } from "./types";

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  trial: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  past_due: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  restricted: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-200",
  suspended: "bg-neutral-200 text-neutral-700 dark:bg-white/10 dark:text-white/70",
};

/**
 * La couleur du retard s'intensifie avec sa durée : un jour de décalage n'a
 * pas à crier aussi fort qu'un impayé de trois semaines, et c'est ce dégradé
 * qui permet de trier les relances d'un coup d'œil sans lire les dates.
 */
function delayStyle(daysLate: number) {
  if (daysLate <= 7) return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300";
  if (daysLate <= 14) return "bg-orange-100 text-orange-800 dark:bg-orange-500/25 dark:text-orange-200";
  return "bg-rose-100 text-rose-800 dark:bg-rose-500/25 dark:text-rose-200";
}

// Libellés courts des pastilles, comme sur la maquette ; le libellé complet reste dans la liste et l'infobulle.
const SHORT_STATUS: Record<SubscriptionStatus, string> = {
  pending: "En attente",
  trial: "Essai",
  active: "Actif",
  past_due: "En retard",
  restricted: "Restreint",
  suspended: "Suspendu",
};

const norm = (v: string) => v.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * Les écoles clientes : filtres par statut, recherche (barre du haut),
 * formule et statut modifiables, paiements, historique et relance WhatsApp.
 * Le filtre et la recherche vivent dans l'adresse : les liens du menu
 * (« En attente d'activation », « Écoles en retard »…) y mènent directement.
 */
export function SchoolsSection({ schools }: { schools: SchoolRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const rawStatus = params.get("statut");
  const status: "all" | SubscriptionStatus = rawStatus && isSubscriptionStatus(rawStatus) ? rawStatus : "all";
  const query = params.get("q") ?? "";
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<SchoolRow | null>(null);
  const [historyTarget, setHistoryTarget] = useState<SchoolRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const filtered = useMemo(() => {
    const words = norm(query).split(/\s+/).filter(Boolean);
    return schools.filter(
      (s) =>
        (status === "all" || s.subscriptionStatus === status) &&
        words.every((w) => norm(`${s.name} ${s.code} ${s.city ?? ""} ${s.directorName ?? ""} ${s.directorPhone ?? ""}`).includes(w)),
    );
  }, [schools, status, query]);

  function setParam(name: "statut" | "q", value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}#ecoles`, { scroll: false });
  }

  async function run(schoolId: string, action: () => Promise<unknown>, success: string) {
    setBusyId(schoolId);
    try {
      await action();
      toast.success(success);
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setBusyId(null);
    }
  }

  async function exportShown() {
    setExporting(true);
    try {
      toast.success(`${await exportSchools(filtered)} école(s) exportée(s).`);
    } catch {
      toast.error("L'export a échoué.");
    } finally {
      setExporting(false);
    }
  }

  const reminderUrl = (s: SchoolRow) =>
    s.directorPhone
      ? buildWhatsAppUrl(
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
        )
      : null;

  return (
    <section id="ecoles" className="min-w-0 scroll-mt-20 rounded-2xl border border-border bg-surface shadow-soft" data-testid="sa-schools">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {(["all", ...SUBSCRIPTION_STATUSES] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setParam("statut", f === "all" ? null : f)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                status === f
                  ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-200"
                  : "border-border text-foreground/70 hover:bg-surface-muted hover:text-foreground",
              )}
              data-testid={`sa-filter-${f}`}
            >
              {f === "all" ? "Toutes" : SUBSCRIPTION_STATUS_LABELS[f]}
              <span className="ms-1.5 opacity-60">
                {f === "all" ? schools.length : schools.filter((s) => s.subscriptionStatus === f).length}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={exportShown}
          disabled={exporting || filtered.length === 0}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium text-foreground/75 transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-40"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exporter en Excel
        </button>
      </div>

      {query && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-foreground/70">
          Recherche : <span className="font-semibold text-foreground">« {query} »</span>
          <button
            type="button"
            onClick={() => setParam("q", null)}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-foreground/60 hover:bg-surface-muted"
          >
            <X className="h-3.5 w-3.5" /> Effacer
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="px-5 py-16 text-center text-sm text-foreground/50">Aucune école ne correspond.</p>
      ) : (
        <>
          {/* Grand écran (1 280 px et plus) : le tableau de la maquette */}
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full text-xs 2xl:text-[13px]" style={{ fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr className="whitespace-nowrap text-start text-xs font-medium text-foreground/55">
                  <th className="px-3 py-3 text-start font-medium">École</th>
                  <th className="px-1.5 py-3 text-start font-medium">Directeur</th>
                  <th className="px-1.5 py-3 text-center font-medium">Élèves</th>
                  <th className="px-1.5 py-3 text-start font-medium">Formule</th>
                  <th className="px-1.5 py-3 text-start font-medium">Statut</th>
                  <th className="whitespace-normal px-1.5 py-3 text-start font-medium leading-tight 2xl:whitespace-nowrap">Dernier paiement</th>
                  <th className="px-1.5 py-3 text-start font-medium">Échéance</th>
                  <th className="px-1.5 py-3 text-end font-medium">Revenu / mois</th>
                  <th className="px-3 py-3 text-end font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-surface-muted/50" data-testid="sa-school-row">
                    <td className="px-3 py-3">
                      <SchoolName school={s} />
                    </td>
                    <td className="px-1.5 py-3">
                      {s.directorName ? (
                        <>
                          <p className="max-w-[8.5rem] truncate text-foreground/85" title={s.directorName}>
                            {s.directorName}
                          </p>
                          <p className="whitespace-nowrap text-xs text-foreground/50" dir="ltr">
                            {s.directorPhone ?? "—"}
                          </p>
                        </>
                      ) : (
                        <span className="text-foreground/35">—</span>
                      )}
                    </td>
                    <td className="px-1.5 py-3 text-center text-foreground/80">{s.studentCount}</td>
                    <td className="px-1.5 py-3">
                      <PlanSelect school={s} busy={busyId === s.id} onChange={(plan) => run(s.id, () => changeSchoolPlan(s.id, plan), "Formule mise à jour.")} />
                    </td>
                    <td className="px-1.5 py-3">
                      <StatusCell
                        school={s}
                        busy={busyId === s.id}
                        onChange={(st) => run(s.id, () => changeSubscriptionStatus(s.id, st), "Statut mis à jour.")}
                      />
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-3 text-foreground/70">{s.lastPaymentAt ? formatDate(s.lastPaymentAt) : "—"}</td>
                    <td className="whitespace-nowrap px-1.5 py-3 text-foreground/70">{s.nextDueAt ? formatDate(s.nextDueAt) : "—"}</td>
                    <td className="whitespace-nowrap px-1.5 py-3 text-end font-semibold text-foreground">
                      {s.amountDue != null ? formatMRU(s.amountDue) : "Sur devis"}
                    </td>
                    <td className="px-3 py-3">
                      <RowActions
                        school={s}
                        busy={busyId === s.id}
                        reminderUrl={reminderUrl(s)}
                        onPay={() => setPayTarget(s)}
                        onHistory={() => setHistoryTarget(s)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tablette, petit portable et téléphone : une carte par école */}
          <ul className="divide-y divide-border xl:hidden">
            {filtered.map((s) => (
              <li key={s.id} className="space-y-3 p-4" data-testid="sa-school-card">
                <div className="flex items-start justify-between gap-3">
                  <SchoolName school={s} />
                  <RowActions
                    school={s}
                    busy={busyId === s.id}
                    reminderUrl={reminderUrl(s)}
                    onPay={() => setPayTarget(s)}
                    onHistory={() => setHistoryTarget(s)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusCell
                    school={s}
                    busy={busyId === s.id}
                    onChange={(st) => run(s.id, () => changeSubscriptionStatus(s.id, st), "Statut mis à jour.")}
                  />
                  <PlanSelect school={s} busy={busyId === s.id} onChange={(plan) => run(s.id, () => changeSchoolPlan(s.id, plan), "Formule mise à jour.")} />
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                  <Field label="Directeur" value={s.directorName ? `${s.directorName}${s.directorPhone ? ` · ${s.directorPhone}` : ""}` : "—"} />
                  <Field label="Élèves" value={String(s.studentCount)} />
                  <Field label="Dernier paiement" value={s.lastPaymentAt ? formatDate(s.lastPaymentAt) : "—"} />
                  <Field label="Prochaine échéance" value={s.nextDueAt ? formatDate(s.nextDueAt) : "—"} />
                  <Field label="Revenu mensuel" value={s.amountDue != null ? formatMRU(s.amountDue) : "Sur devis"} strong />
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}

      <MarkPaidDialog
        target={payTarget ? { id: payTarget.id, name: payTarget.name, amountDue: payTarget.amountDue } : null}
        onOpenChange={(open) => !open && setPayTarget(null)}
      />
      <HistoryDialog
        target={historyTarget ? { id: historyTarget.id, name: historyTarget.name } : null}
        onOpenChange={(open) => !open && setHistoryTarget(null)}
      />
    </section>
  );
}

function SchoolName({ school }: { school: SchoolRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        <Building2 className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block max-w-[9rem] truncate font-semibold text-foreground 2xl:max-w-[10rem]" title={school.name}>
          {school.name}
        </span>
        <span className="block text-xs text-foreground/50">
          {school.code}
          {school.city ? ` · ${school.city}` : ""}
        </span>
      </span>
    </div>
  );
}

function PlanSelect({ school, busy, onChange }: { school: SchoolRow; busy: boolean; onChange: (plan: string) => void }) {
  return (
    <select
      value={school.plan}
      disabled={busy}
      onChange={(e) => onChange(e.target.value)}
      aria-label={`Formule de ${school.name}`}
      className="h-8 rounded-lg border border-border bg-surface ps-2 pe-1 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:opacity-50"
    >
      {PLANS.map((p) => (
        <option key={p} value={p}>
          {PLAN_LABELS[p]}
        </option>
      ))}
    </select>
  );
}

function StatusCell({ school: s, busy, onChange }: { school: SchoolRow; busy: boolean; onChange: (status: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={cn(
          "relative inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-full px-3 text-xs font-semibold focus-within:ring-2 focus-within:ring-primary-500/40",
          STATUS_STYLES[s.subscriptionStatus],
          busy && "opacity-50",
        )}
      >
        <span title={SUBSCRIPTION_STATUS_LABELS[s.subscriptionStatus]}>{SHORT_STATUS[s.subscriptionStatus]}</span>
        <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
        <select
          value={s.subscriptionStatus}
          disabled={busy}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Statut de ${s.name}`}
          className="absolute inset-0 cursor-pointer opacity-0"
          data-testid="sa-status"
        >
          {SUBSCRIPTION_STATUSES.map((st) => (
            <option key={st} value={st}>
              {SUBSCRIPTION_STATUS_LABELS[st]}
            </option>
          ))}
        </select>
      </span>
      {s.daysLate != null ? (
        <span title={`Échéance dépassée depuis ${s.daysLate} jour(s)`} className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", delayStyle(s.daysLate))}>
          {s.daysLate} j
        </span>
      ) : (
        /* Marquée comme devant de l'argent, mais sans retard calculable :
           l'échéance est à venir ou absente. Le signaler vaut mieux que de
           laisser la case vide, qui se lirait à tort comme « à jour ». */
        isOwingStatus(s.subscriptionStatus) && (
          <span
            title={
              s.nextDueAt
                ? `Statut « ${SUBSCRIPTION_STATUS_LABELS[s.subscriptionStatus]} » alors que l'échéance du ${formatDate(s.nextDueAt)} n'est pas encore dépassée — vérifiez la date.`
                : "Aucune date d'échéance enregistrée : le retard ne peut pas être calculé. Enregistrez un paiement pour en fixer une."
            }
            className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-foreground/55"
          >
            échéance ?
          </span>
        )
      )}
    </div>
  );
}

function RowActions({
  school: s,
  busy,
  reminderUrl,
  onPay,
  onHistory,
}: {
  school: SchoolRow;
  busy: boolean;
  reminderUrl: string | null;
  onPay: () => void;
  onHistory: () => void;
}) {
  const icon = "flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted hover:text-foreground";
  return (
    <div className="flex items-center justify-end gap-0.5">
      {busy && <Loader2 className="me-1 h-4 w-4 animate-spin text-foreground/40" />}
      <button type="button" onClick={onPay} title="Enregistrer un paiement" aria-label={`Enregistrer un paiement — ${s.name}`} className={icon} data-testid="sa-pay">
        <Pencil className="h-4 w-4" />
      </button>
      <button type="button" onClick={onHistory} title="Historique des paiements" aria-label={`Historique — ${s.name}`} className={icon} data-testid="sa-history">
        <Eye className="h-4 w-4" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger className={icon} aria-label={`Plus d'actions — ${s.name}`}>
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[14rem]">
          {reminderUrl ? (
            <DropdownMenuItem asChild>
              <a href={reminderUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4 text-emerald-600" />
                {reminderButtonTitle(s.subscriptionStatus)}
              </a>
            </DropdownMenuItem>
          ) : (
            <p className="px-2.5 py-2 text-xs text-foreground/50">Aucun numéro pour relancer sur WhatsApp</p>
          )}
          <DropdownMenuItem onSelect={onPay}>
            <Banknote className="h-4 w-4 text-foreground/60" />
            Enregistrer un paiement
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onHistory}>
            <History className="h-4 w-4 text-foreground/60" />
            Historique des paiements
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-foreground/50">{label}</dt>
      <dd className={cn("truncate", strong ? "font-semibold text-foreground" : "text-foreground/80")}>{value}</dd>
    </div>
  );
}
