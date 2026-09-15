"use client";

import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronRight,
  Download,
  FilePlus2,
  HandCoins,
  Loader2,
  Percent,
  Plus,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ListPagination } from "@/components/ui/list-pagination";
import { AlphabetFilter, matchesLetter } from "@/components/ui/alphabet-filter";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { formatAmount, formatDateIn, formatLongDate, formatLongDateAr, formatMRU } from "@/lib/format";
import { buildWhatsAppUrl, fillTemplate, schoolSignatureAr, schoolSignatureFr, withArabic } from "@/lib/whatsapp";
import type { FeeDisplayStatus } from "@/lib/fee-status";
import { matchesFeeFilters, type FeeListFilters, type PaymentStatusFilter } from "@/lib/payments-list";
import { exportElementToPdf } from "@/lib/pdf-export";
import { useLanguage } from "@/lib/i18n/language-provider";
import { FeeFormDialog, type FeeEditTarget, type FeeStudentOption } from "./fee-form-dialog";
import { PaymentDialog } from "./payment-dialog";
import { deleteFee } from "./actions";
import { PaymentsToolbar } from "./payments-list/payments-toolbar";
import { PaymentsTable, type FeeRowActions } from "./payments-list/payments-table";
import { PaymentsBulkBar } from "./payments-list/payments-bulk-bar";
import { FeeDetailSheet } from "./payments-list/fee-detail-sheet";
import { RemindersDialog } from "./payments-list/reminders-dialog";
import { PaymentsReport } from "./payments-list/payments-report";

export interface FeeRow {
  id: string;
  label: string;
  amount: number;
  /** ISO */
  dueDate: string;
  totalPaid: number;
  remaining: number;
  /** Statut et retard calculés au rendu serveur (voir page.tsx). */
  status: FeeDisplayStatus;
  overdueDays: number;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    photoUrl: string | null;
    classId: string | null;
    className: string | null;
  };
  parent: { firstName: string; lastName: string; phone: string; relationship: string | null } | null;
  /** Du plus ancien au plus récent. */
  payments: { id: string; receiptNumber: string; amount: number; method: string; paidAt: string }[];
}

export interface PaymentsKpis {
  collected: number;
  /** Encaissé chaque mois, sur les six derniers mois. */
  collectedByMonth: number[];
  /** Évolution du mois en cours sur le précédent, en %. */
  collectedChange: number | null;
  outstanding: number;
  lateCount: number;
  paymentCount: number;
  paymentsByMonth: number[];
  billed: number;
  rate: number | null;
}

const PAGE_SIZE = 10;

export function FinanceView({
  fees,
  kpis,
  students,
  schoolName,
  reminderTemplate,
  reminderTemplateAr,
  initialStatus = "ALL",
}: {
  fees: FeeRow[];
  kpis: PaymentsKpis;
  students: FeeStudentOption[];
  schoolName: string;
  reminderTemplate: string;
  reminderTemplateAr?: string;
  /** Filtre au premier affichage (voir le lien « Impayés » du menu). */
  initialStatus?: PaymentStatusFilter;
}) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [filters, setFilters] = useState<FeeListFilters>({
    query: "",
    classId: "ALL",
    status: initialStatus,
    method: "ALL",
    from: "",
    to: "",
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const [letter, setLetter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [feeForm, setFeeForm] = useState<{ edit: FeeEditTarget | null } | null>(null);
  const [paymentFor, setPaymentFor] = useState<{ feeId: string | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeeRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [exportRows, setExportRows] = useState<FeeRow[] | null>(null);

  const classes = useMemo(() => {
    const names = new Map<string, string>();
    for (const f of fees) {
      if (f.student.classId && f.student.className) names.set(f.student.classId, f.student.className);
    }
    return [...names.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [fees]);

  const filtered = useMemo(
    () =>
      fees.filter(
        (f) =>
          matchesFeeFilters(f, filters) &&
          matchesLetter(`${f.student.firstName} ${f.student.lastName}`, letter),
      ),
    [fees, filters, letter],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedFees = fees.filter((f) => selected.has(f.id));
  const detailFee = fees.find((f) => f.id === detailId) ?? null;
  const hasUnsettled = fees.some((f) => f.remaining > 0);

  /** Tout changement de filtre ramène à la première page. */
  function updateFilters(patch: Partial<FeeListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  const schoolFr = schoolSignatureFr(schoolName);
  const schoolAr = schoolSignatureAr(schoolName);

  function reminderUrl(fee: FeeRow): string | null {
    if (!fee.parent || fee.remaining <= 0) return null;
    const parentName = `${fee.parent.firstName} ${fee.parent.lastName}`;
    const studentName = `${fee.student.firstName} ${fee.student.lastName}`;
    const amount = formatAmount(fee.remaining);
    const message = withArabic(
      fillTemplate(reminderTemplate, {
        parentName,
        studentName,
        amount,
        date: formatLongDate(fee.dueDate),
        schoolName: schoolFr,
      }),
      reminderTemplateAr &&
        fillTemplate(reminderTemplateAr, {
          parentName,
          studentName,
          amount,
          date: formatLongDateAr(fee.dueDate),
          schoolName: schoolAr,
        }),
    );
    return buildWhatsAppUrl(fee.parent.phone, message);
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const f of pageRows) {
        if (checked) next.add(f.id);
        else next.delete(f.id);
      }
      return next;
    });
  }

  function openEdit(fee: FeeRow) {
    setDetailId(null);
    setFeeForm({
      edit: {
        id: fee.id,
        studentName: `${fee.student.firstName} ${fee.student.lastName}`,
        className: fee.student.className,
        label: fee.label,
        amount: fee.amount,
        dueDate: fee.dueDate,
        totalPaid: fee.totalPaid,
      },
    });
  }

  function openPayment(fee: FeeRow | null) {
    setDetailId(null);
    setPaymentFor({ feeId: fee?.id ?? null });
  }

  const actions: FeeRowActions = {
    onView: (fee) => setDetailId(fee.id),
    onEdit: openEdit,
    onRecordPayment: openPayment,
    onDelete: setDeleteTarget,
    reminderUrl,
  };

  /**
   * Un frais déjà réglé n'est pas supprimable : ses paiements partiraient avec
   * lui (onDelete: Cascade), emportant des reçus déjà remis aux parents. Le
   * menu ne le propose donc que tant qu'aucun paiement n'est rattaché.
   */
  async function handleDeleteFee() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFee(deleteTarget.id);
      toast.success(t("finance.feeDeleted"));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      setDeleteTarget(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setDeleting(false);
    }
  }

  /**
   * Export PDF de lignes données : toute la liste filtrée, ou la sélection.
   * Le document n'est rendu, hors écran, que le temps de la capture — flushSync
   * l'écrit dans la page avant que la capture ne le cherche.
   */
  async function exportPdf(rows: FeeRow[], suffix: string) {
    if (rows.length === 0 || exportRows) return;
    flushSync(() => setExportRows(rows));
    try {
      const element = document.getElementById("payments-report");
      if (!element) throw new Error("report missing");
      await exportElementToPdf(element, `paiements-${suffix}.pdf`);
      toast.success(t("pdf.downloaded"));
    } catch {
      toast.error(t("pdf.failed"));
    } finally {
      setExportRows(null);
    }
  }

  const lastMonth = kpis.collectedByMonth.length - 1;
  const change = kpis.collectedChange;
  const collectedHint =
    change == null
      ? t("finance.collectedThisMonth").replace("{amount}", formatAmount(kpis.collectedByMonth[lastMonth] ?? 0))
      : `${change > 0 ? "+" : ""}${change}% ${t("finance.thisMonthShort")}`;
  const paymentsThisMonth = kpis.paymentsByMonth[kpis.paymentsByMonth.length - 1] ?? 0;
  const from = (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, filtered.length);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav
            aria-label={t("nav.category.finance")}
            className="mb-1.5 flex items-center gap-1.5 text-xs text-foreground/50"
          >
            <span>{t("nav.category.finance")}</span>
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            <span className="font-medium text-foreground/70">{t("nav.payments")}</span>
          </nav>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <Wallet className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("nav.payments")}</h1>
              <p className="mt-0.5 text-sm text-foreground/60">{t("finance.subtitlePayments")}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => exportPdf(filtered, "liste")}
            disabled={exportRows != null || filtered.length === 0}
          >
            {exportRows ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t("finance.exportPdf")}
          </Button>
          <Button variant="secondary" onClick={() => setFeeForm({ edit: null })}>
            <FilePlus2 className="h-4 w-4" />
            {t("finance.newFee")}
          </Button>
          <Button
            className="shadow-sm"
            onClick={() => openPayment(null)}
            disabled={!hasUnsettled}
            title={hasUnsettled ? undefined : t("finance.nothingToCollect")}
          >
            <Plus className="h-4 w-4" />
            {t("finance.newPayment")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("finance.totalCollected")}
          value={formatMRU(kpis.collected)}
          icon={Wallet}
          tone="emerald"
          hint={collectedHint}
          hintPositive={(change ?? 0) > 0}
          hintNegative={(change ?? 0) < 0}
          trend={kpis.collectedByMonth}
          delay={40}
        />
        <KpiCard
          label={t("finance.totalOutstanding")}
          value={formatMRU(kpis.outstanding)}
          icon={HandCoins}
          tone="amber"
          hint={
            kpis.lateCount > 0
              ? t("finance.lateCount").replace("{n}", String(kpis.lateCount))
              : t("finance.nothingLate")
          }
          delay={80}
        />
        <KpiCard
          label={t("finance.paymentsCount")}
          value={String(kpis.paymentCount)}
          icon={ReceiptText}
          tone="blue"
          hint={
            paymentsThisMonth > 0
              ? `+${paymentsThisMonth} ${t("finance.thisMonthShort")}`
              : t("finance.noPaymentThisMonth")
          }
          hintPositive={paymentsThisMonth > 0}
          trend={kpis.paymentsByMonth}
          delay={120}
        />
        <KpiCard
          label={t("finance.collectionRate")}
          value={kpis.rate == null ? "—" : `${kpis.rate}%`}
          icon={Percent}
          tone="cyan"
          hint={t("finance.rateOfBilled").replace("{amount}", formatMRU(kpis.billed))}
          ring={kpis.rate ?? undefined}
          ringPlacement="icon"
          delay={160}
        />
      </div>

      <PaymentsToolbar
        filters={filters}
        onChange={updateFilters}
        classes={classes}
        panelOpen={panelOpen}
        onPanelOpenChange={setPanelOpen}
      />

      <AlphabetFilter
        names={fees.map((f) => `${f.student.firstName} ${f.student.lastName}`)}
        value={letter}
        onChange={(value) => {
          setLetter(value);
          setPage(1);
        }}
      />

      <section className="overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-soft">
        {selected.size > 0 && (
          <PaymentsBulkBar
            count={selected.size}
            exporting={exportRows != null}
            onRemind={() => setRemindersOpen(true)}
            onExport={() => exportPdf(selectedFees, "selection")}
            onClear={() => setSelected(new Set())}
          />
        )}
        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-foreground/50">
            {fees.length === 0 ? t("finance.emptyList") : t("finance.noMatch")}
          </div>
        ) : (
          <>
            <PaymentsTable
              rows={pageRows}
              selected={selected}
              onToggleRow={toggleRow}
              onTogglePage={togglePage}
              actions={actions}
            />
            <ListPagination
              page={currentPage}
              pageCount={pageCount}
              summary={t("finance.showing")
                .replace("{from}", String(from))
                .replace("{to}", String(to))
                .replace("{total}", String(filtered.length))}
              previousLabel={t("students.previousPage")}
              nextLabel={t("students.nextPage")}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      <FeeDetailSheet
        fee={detailFee}
        onClose={() => setDetailId(null)}
        onEdit={openEdit}
        onRecordPayment={openPayment}
        reminderUrl={reminderUrl}
      />
      <FeeFormDialog
        open={feeForm != null}
        onOpenChange={(open) => !open && setFeeForm(null)}
        students={students}
        editTarget={feeForm?.edit ?? null}
      />
      <PaymentDialog
        open={paymentFor != null}
        onOpenChange={(open) => !open && setPaymentFor(null)}
        fees={fees}
        feeId={paymentFor?.feeId ?? null}
      />
      <RemindersDialog
        open={remindersOpen}
        onOpenChange={setRemindersOpen}
        fees={selectedFees}
        reminderUrl={reminderUrl}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("finance.deleteFeeTitle")}
        description={
          deleteTarget
            ? t("finance.deleteFeeHint")
                .replace("{label}", deleteTarget.label)
                .replace("{student}", `${deleteTarget.student.firstName} ${deleteTarget.student.lastName}`)
                .replace("{amount}", formatMRU(deleteTarget.amount))
            : undefined
        }
        confirmLabel={t("finance.deleteFee")}
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteFee}
      />

      {exportRows && (
        <div aria-hidden className="pointer-events-none fixed top-0" style={{ left: -12000 }}>
          <PaymentsReport
            rows={exportRows}
            schoolName={schoolName}
            generatedOn={formatDateIn(locale, new Date(), { day: "numeric", month: "long", year: "numeric" })}
          />
        </div>
      )}
    </div>
  );
}
