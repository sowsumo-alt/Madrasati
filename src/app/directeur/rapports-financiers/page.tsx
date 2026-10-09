import Link from "next/link";
import { AlertTriangle, Ban, Banknote, CalendarClock, FileChartColumn, Receipt, Wallet } from "lucide-react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { loadDueRule } from "@/lib/due-rule-data";
import { effectiveDueDate } from "@/lib/due-rule";
import { balanceOf } from "@/lib/money";
import { familyLabel } from "@/lib/family";
import { formatMRU } from "@/lib/format";
import { monthLabel } from "@/lib/tuition";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/payment-methods";
import { buildFinancialReport, receiptKey, type Breakdown, type DebtorGroup } from "@/lib/financial-report";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { ColumnChart } from "@/components/charts/chart-primitives";
import { PrintButton } from "@/components/ui/print-button";
import { reportPeriod } from "./period";
import { ReportExportButton } from "./export-button";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
/** « Sept. », « Oct. »… pour l'axe du graphique. */
const SHORT_MONTH = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });

/**
 * Rapports financiers : pour une année scolaire (et un mois, au choix), ce
 * qui est facturé, encaissé et dû — par mois, par mode de paiement, par
 * classe et par type de frais —, les familles qui doivent le plus et les
 * reçus annulés. Imprimable et exportable en Excel.
 */
export default async function FinancialReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; mois?: string }>;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const { annee, mois } = await searchParams;
  const now = new Date();

  const years = await prisma.academicYear.findMany({
    where: { schoolId: user.schoolId },
    orderBy: { startDate: "desc" },
    select: { id: true, label: true, isCurrent: true, startDate: true, endDate: true },
  });
  const year = years.find((y) => y.id === annee) ?? years.find((y) => y.isCurrent) ?? years[0];
  if (!year) {
    return <p className="rounded-xl bg-surface-muted px-4 py-6 text-sm text-foreground/60">Aucune année scolaire.</p>;
  }
  const period = reportPeriod(year, mois);
  const yearRange = reportPeriod(year, null);

  const [fees, yearPayments, cancelled, links, dueRule] = await Promise.all([
    prisma.fee.findMany({
      where: { schoolId: user.schoolId, academicYearId: year.id },
      select: {
        studentId: true,
        label: true,
        amount: true,
        dueDate: true,
        periodStart: true,
        payments: { select: { amount: true } },
        student: { select: { classRoom: { select: { name: true } } } },
      },
    }),
    prisma.payment.findMany({
      where: { schoolId: user.schoolId, paidAt: { gte: yearRange.from, lt: yearRange.to } },
      select: { amount: true, method: true, paidAt: true, receiptNumber: true },
    }),
    prisma.cancelledPayment.findMany({
      where: { schoolId: user.schoolId, cancelledAt: { gte: period.from, lt: period.to } },
      select: { amount: true },
    }),
    // La famille de chaque élève : un impayé se compte par famille.
    prisma.student.findMany({
      where: { schoolId: user.schoolId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        parentLinks: {
          where: { isPrimary: true },
          take: 1,
          select: { parent: { select: { id: true, familyName: true, lastName: true, _count: { select: { studentLinks: true } } } } },
        },
      },
    }),
    loadDueRule(user.schoolId),
  ]);

  const groups = new Map<string, DebtorGroup>();
  for (const s of links) {
    const parent = s.parentLinks[0]?.parent;
    groups.set(
      s.id,
      parent && parent._count.studentLinks >= 2
        ? { key: parent.id, label: familyLabel(parent, "Famille {name}"), href: `/directeur/familles/${parent.id}` }
        : {
            key: s.id,
            label: `${s.firstName} ${s.lastName}`.trim(),
            href: parent ? `/directeur/familles/${parent.id}` : `/directeur/eleves?q=${encodeURIComponent(s.lastName)}`,
          },
    );
  }

  const inPeriod = yearPayments.filter((p) => p.paidAt >= period.from && p.paidAt < period.to);
  const report = buildFinancialReport({
    fees: fees.map((f) => ({
      studentId: f.studentId,
      className: f.student.classRoom?.name ?? null,
      label: f.label,
      amount: f.amount,
      dueDate: effectiveDueDate(f, dueRule),
      paid: f.payments.reduce((sum, p) => sum + p.amount, 0),
    })),
    payments: inPeriod,
    cancelled,
    receiptKeys: inPeriod.map((p) => receiptKey(p.receiptNumber)),
    groupOf: (id) => groups.get(id) ?? { key: id, label: "Élève", href: "/directeur/eleves" },
    now,
  });

  // Ce qui reste dû des années précédentes : toujours dû, mais hors des frais
  // de l'année affichée. Sans cette ligne, le rapport de la nouvelle année
  // paraissait à jour alors que les impayés de l'an passé restaient à encaisser.
  const olderFees = await prisma.fee.findMany({
    where: { schoolId: user.schoolId, status: { not: "PAID" }, academicYear: { startDate: { lt: year.startDate } } },
    select: { amount: true, dueDate: true, periodStart: true, payments: { select: { amount: true } } },
  });
  const previousDue = balanceOf(
    olderFees.map((f) => ({ amount: f.amount, paid: f.payments.reduce((sum, p) => sum + p.amount, 0), dueDate: effectiveDueDate(f, dueRule) })),
    now,
  ).due;

  const byMonth = period.months.map((m) => ({
    label: capitalize(SHORT_MONTH.format(m)),
    value: yearPayments
      .filter((p) => p.paidAt.getUTCFullYear() === m.getUTCFullYear() && p.paidAt.getUTCMonth() === m.getUTCMonth())
      .reduce((sum, p) => sum + p.amount, 0),
  }));
  const periodLabel = period.month ? capitalize(monthLabel(period.from)) : `Année ${year.label}`;
  const summary = [
    { Rubrique: "Période", Valeur: periodLabel },
    { Rubrique: "Facturé sur l'année (MRU)", Valeur: report.totals.billed },
    { Rubrique: "Versé sur l'année (MRU)", Valeur: report.totals.paid },
    { Rubrique: "Reste dû à ce jour (MRU)", Valeur: report.totals.due },
    { Rubrique: "À venir (MRU)", Valeur: report.totals.upcoming },
    { Rubrique: "Encaissé sur la période (MRU)", Valeur: report.collected },
    { Rubrique: "Reçus sur la période", Valeur: report.receipts },
    { Rubrique: "Reçus annulés sur la période", Valeur: report.cancelled.count },
    { Rubrique: "Montant annulé (MRU)", Valeur: report.cancelled.amount },
  ];

  return (
    <div className="space-y-5" data-testid="financial-report">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <FileChartColumn className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Rapports financiers</h1>
            <p className="text-sm text-foreground/60">
              {periodLabel} · facturé, encaissé et dû, par mois, mode de paiement, classe et type de frais.
            </p>
          </div>
        </div>
        <div className="no-print flex flex-wrap items-end gap-2">
          <form className="flex flex-wrap items-end gap-2" action="/directeur/rapports-financiers">
            <label className="space-y-1 text-xs font-medium text-foreground/60">
              <span className="block">Année scolaire</span>
              <select name="annee" defaultValue={year.id} className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground" data-testid="report-year">
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-foreground/60">
              <span className="block">Période</span>
              <select name="mois" defaultValue={period.month ?? ""} className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground" data-testid="report-month">
                <option value="">Toute l&apos;année</option>
                {period.months.map((m) => (
                  <option key={m.toISOString()} value={m.toISOString().slice(0, 7)}>
                    {capitalize(monthLabel(m))}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="h-10 rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white hover:bg-primary-800">
              Afficher
            </button>
          </form>
          <ReportExportButton
            yearId={year.id}
            month={period.month}
            fileLabel={period.month ?? year.label}
            summary={summary}
          />
          <PrintButton label="Imprimer" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <KpiCard label="Facturé sur l'année" value={formatMRU(report.totals.billed)} icon={Receipt} tone="blue" hint={`Versé : ${formatMRU(report.totals.paid)}`} />
        <KpiCard label={period.month ? "Encaissé ce mois" : "Encaissé sur l'année"} value={formatMRU(report.collected)} icon={Banknote} tone="emerald" hint={`${report.receipts} reçu(s)`} />
        <KpiCard
          label="Reste dû à ce jour"
          value={formatMRU(report.totals.due)}
          icon={AlertTriangle}
          tone="rose"
          hint={previousDue > 0 ? `+ ${formatMRU(previousDue)} des années précédentes` : "mois échus non réglés"}
          href="/directeur/finance?statut=impayes"
        />
        <KpiCard label="À venir" value={formatMRU(report.totals.upcoming)} icon={CalendarClock} tone="amber" hint="mois pas encore arrivés" />
        <KpiCard label="Reçus annulés" value={String(report.cancelled.count)} icon={Ban} tone="violet" hint={formatMRU(report.cancelled.amount)} href="/directeur/activite?type=CANCEL" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard title="Encaissements par mois (MRU)" icon={Banknote}>
          <div className="w-full">
            <ColumnChart data={byMonth} />
          </div>
        </SectionCard>
        <SectionCard title="Par mode de paiement" icon={Wallet}>
          {report.byMethod.length === 0 ? (
            <p className="py-8 text-center text-sm text-foreground/50">Aucun encaissement sur la période.</p>
          ) : (
            <ul className="w-full space-y-3" data-testid="report-methods">
              {report.byMethod.map((m) => (
                <li key={m.method} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">{PAYMENT_METHOD_LABELS[m.method as PaymentMethod] ?? m.method}</span>
                    <span className="text-foreground/70" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatMRU(m.amount)} · {m.count} paiement(s) · {m.share} %
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-primary-600" style={{ width: `${m.share}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard title="Par classe (année)" icon={Receipt}>
          <BreakdownTable rows={report.byClass} first="Classe" testId="report-classes" />
        </SectionCard>
        <SectionCard title="Par type de frais (année)" icon={Receipt}>
          <BreakdownTable rows={report.byKind} first="Type de frais" testId="report-kinds" />
        </SectionCard>
      </div>

      <SectionCard title="Les plus gros impayés à ce jour" icon={AlertTriangle} href="/directeur/finance?statut=impayes" linkLabel="Tous les impayés">
        {report.topDebtors.length === 0 ? (
          <p className="py-6 text-center text-sm text-foreground/50">Personne ne doit rien à ce jour.</p>
        ) : (
          <ol className="w-full divide-y divide-border/70" data-testid="report-debtors">
            {report.topDebtors.map((d, i) => (
              <li key={d.href + d.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="w-5 text-end text-xs text-foreground/40">{i + 1}</span>
                  <Link href={d.href} className="truncate font-medium text-primary-800 hover:underline">
                    {d.label}
                  </Link>
                </span>
                <span className="shrink-0 font-semibold text-amber-700" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatMRU(d.due)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
    </div>
  );
}

function BreakdownTable({ rows, first, testId }: { rows: Breakdown[]; first: string; testId: string }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-foreground/50">Aucun frais cette année.</p>;
  const total = rows.reduce((acc, r) => ({ billed: acc.billed + r.billed, paid: acc.paid + r.paid, due: acc.due + r.due }), { billed: 0, paid: 0, due: 0 });
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[26rem] text-sm" style={{ fontVariantNumeric: "tabular-nums" }} data-testid={testId}>
        <thead className="text-xs text-foreground/55">
          <tr>
            <th className="py-2 text-start font-medium">{first}</th>
            <th className="py-2 text-end font-medium">Facturé</th>
            <th className="py-2 text-end font-medium">Versé</th>
            <th className="py-2 text-end font-medium">Reste dû à ce jour</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="py-2 font-medium text-foreground">{r.label}</td>
              <td className="py-2 text-end text-foreground/80">{formatMRU(r.billed)}</td>
              <td className="py-2 text-end text-emerald-700">{formatMRU(r.paid)}</td>
              <td className={`py-2 text-end font-semibold ${r.due > 0 ? "text-amber-700" : "text-foreground/45"}`}>{formatMRU(r.due)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-border font-semibold">
            <td className="py-2">Total</td>
            <td className="py-2 text-end">{formatMRU(total.billed)}</td>
            <td className="py-2 text-end text-emerald-700">{formatMRU(total.paid)}</td>
            <td className="py-2 text-end text-amber-700">{formatMRU(total.due)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
