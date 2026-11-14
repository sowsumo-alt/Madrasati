"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, Download, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney, type AmountUnit } from "@/lib/money";
import { exportElementsToPdf } from "@/lib/pdf-export";
import { cn } from "@/lib/utils";
import type { ClassPaymentRow, ClassPaymentTotals, MonthStatus } from "@/lib/class-payments";
import { FeeStatusBadge } from "../payments-list/fee-status-badge";

export interface ClassPaymentsSection {
  classId: string;
  className: string;
  rows: ClassPaymentRow[];
  totals: ClassPaymentTotals;
}

type Filter = "ALL" | "PAID" | "UNPAID";

const FILTERS: [Filter, string][] = [
  ["ALL", "Tous"],
  ["PAID", "Payés"],
  ["UNPAID", "Pas encore payé"],
];

const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const keep = (status: MonthStatus, filter: Filter) =>
  filter === "ALL" || (filter === "PAID" ? status === "PAID" : status === "PARTIAL" || status === "OVERDUE" || status === "PENDING");

function StatusCell({ status }: { status: MonthStatus }) {
  if (status === "NO_FEE") {
    return <span className="whitespace-nowrap text-xs text-foreground/50">Pas de frais ce mois</span>;
  }
  return <FeeStatusBadge status={status} />;
}

/**
 * Paiements par classe : une classe (ou toutes) et un mois ; un tableau par
 * classe, imprimable et exportable en PDF (une page par classe).
 */
export function ClassPaymentsView({
  classes,
  classId,
  months,
  month,
  sections,
  schoolName,
  unit,
}: {
  classes: { id: string; name: string }[];
  classId: string;
  months: string[];
  month: string;
  sections: ClassPaymentsSection[];
  schoolName: string;
  unit: AmountUnit;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [exporting, setExporting] = useState(false);
  const money = (n: number) => formatMoney(n, unit);

  function go(next: { classe?: string; mois?: string }) {
    const qs = new URLSearchParams({ classe: next.classe ?? classId, mois: next.mois ?? month });
    router.push(`/directeur/finance/par-classe?${qs}`);
  }

  async function exportPdf() {
    const elements = [...document.querySelectorAll<HTMLElement>("[data-class-payments]")];
    if (elements.length === 0) return;
    setExporting(true);
    try {
      const name = classId === "toutes" ? "toutes-les-classes" : (sections[0]?.className ?? "classe");
      await exportElementsToPdf(elements, `paiements-${name}-${month}.pdf`.replace(/\s+/g, "-"));
      toast.success("PDF téléchargé.");
    } catch {
      toast.error("Le PDF n'a pas pu être créé. Réessayez.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <ClipboardList className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Paiements par classe</h1>
            <p className="text-sm text-foreground/60">Qui a payé le mois choisi, classe par classe — prêt à imprimer.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => window.print()} data-testid="class-payments-print">
            <Printer className="h-4 w-4" />
            Imprimer
          </Button>
          <Button variant="secondary" onClick={exportPdf} disabled={exporting} data-testid="class-payments-pdf">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            PDF
          </Button>
        </div>
      </div>

      <div className="no-print flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground/70">Classe</span>
          <select
            value={classId}
            onChange={(e) => go({ classe: e.target.value })}
            className="h-10 min-w-40 rounded-lg border border-border bg-surface px-3"
            data-testid="class-payments-class"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="toutes">Toutes les classes</option>
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground/70">Mois</span>
          <select
            value={month}
            onChange={(e) => go({ mois: e.target.value })}
            className="h-10 min-w-44 rounded-lg border border-border bg-surface px-3"
            data-testid="class-payments-month"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <div className="ms-auto flex rounded-xl border border-border bg-surface p-1 text-sm" role="group">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={cn(
                "rounded-lg px-3 py-1.5 font-medium transition-colors",
                filter === value ? "bg-primary-700 text-white" : "text-foreground/70 hover:bg-surface-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {classes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-foreground/60">
          Aucune classe pour l&apos;année en cours.
        </p>
      ) : (
        sections.map((section) => {
          const rows = section.rows.filter((r) => keep(r.status, filter));
          const t = section.totals;
          return (
            <section
              key={section.classId}
              data-paper
              data-class-payments
              className="rounded-2xl border border-border bg-surface p-5 shadow-soft print:break-after-page print:rounded-none print:border-0 print:p-0 print:shadow-none"
            >
              <header className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">{schoolName}</p>
                  <h2 className="text-lg font-bold text-foreground" data-testid="class-payments-title">
                    Classe {section.className} — {monthLabel(month)}
                  </h2>
                </div>
                <p className="text-sm text-foreground/70" data-testid="class-payments-summary">
                  <b className="text-emerald-700">{t.count.PAID}</b> payé{t.count.PAID > 1 ? "s" : ""} ·{" "}
                  <b className="text-amber-700">{t.count.PARTIAL}</b> en partie ·{" "}
                  <b className="text-red-700">{t.count.OVERDUE + t.count.PENDING}</b> pas encore · sur {t.students} élève
                  {t.students > 1 ? "s" : ""}
                </p>
              </header>

              {section.rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-foreground/60">Aucun élève actif dans cette classe.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
                    <thead>
                      <tr className="border-b border-border text-start text-xs font-semibold uppercase tracking-wide text-foreground/50">
                        <th className="w-8 py-2 pe-2 text-start">N°</th>
                        <th className="py-2 pe-3 text-start">Élève</th>
                        <th className="py-2 pe-3 text-start">Statut</th>
                        <th className="py-2 pe-3 text-end">Montant</th>
                        <th className="py-2 pe-3 text-end">Versé</th>
                        <th className="py-2 text-end">Reste</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.id} className="border-b border-border/60 align-top" data-testid="class-payment-row" data-status={r.status}>
                          <td className="py-2 pe-2 text-foreground/50">{i + 1}</td>
                          <td className="py-2 pe-3">
                            <p className="font-medium text-foreground">
                              {r.firstName} {r.lastName}
                            </p>
                            {r.matricule && <p className="text-xs text-foreground/50">{r.matricule}</p>}
                            {r.family && (
                              <p className="text-xs text-violet-700">
                                Fiche familiale — portée par {r.family.holder}
                                {r.family.holderClass ? ` (${r.family.holderClass})` : ""}
                              </p>
                            )}
                          </td>
                          <td className="py-2 pe-3">
                            <StatusCell status={r.status} />
                          </td>
                          <td className="py-2 pe-3 text-end">{r.family ? "—" : r.amount ? money(r.amount) : "—"}</td>
                          <td className="py-2 pe-3 text-end text-emerald-700">{r.family ? "—" : r.paid ? money(r.paid) : "—"}</td>
                          <td className={cn("py-2 text-end", r.remaining > 0 && "font-semibold text-red-700")}>
                            {r.family ? "—" : r.remaining ? money(r.remaining) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold text-foreground">
                        <td className="pt-3" />
                        <td className="pt-3" colSpan={2}>
                          Total de la classe
                        </td>
                        <td className="pt-3 text-end" data-testid="class-payments-expected">
                          {money(t.expected)}
                        </td>
                        <td className="pt-3 text-end text-emerald-700" data-testid="class-payments-collected">
                          {money(t.collected)}
                        </td>
                        <td className="pt-3 text-end text-red-700">{money(t.remaining)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  {rows.length === 0 && (
                    <p className="py-4 text-center text-sm text-foreground/60">Aucun élève dans ce filtre.</p>
                  )}
                </div>
              )}
              <p className="mt-3 text-xs text-foreground/50">
                Un frais qui couvre plusieurs mois (trimestre, année) compte pour chacun de ses mois, à son montant saisi.
                Fiche familiale : l&apos;argent est compté une seule fois, chez l&apos;enfant qui la porte.
              </p>
            </section>
          );
        })
      )}
    </div>
  );
}
