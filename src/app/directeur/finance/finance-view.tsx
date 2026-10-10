"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronRight,
  Download,
  CalendarClock,
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
import { AlphabetFilter } from "@/components/ui/alphabet-filter";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { formatAmount, formatDateIn, formatLongDate, formatLongDateAr, formatMRU } from "@/lib/format";
import { buildWhatsAppUrl, fillTemplate, schoolSignatureAr, schoolSignatureFr, withArabic } from "@/lib/whatsapp";
import type { FeeDisplayStatus } from "@/lib/fee-status";
import type { FeeListFilters } from "@/lib/payments-list";
import { PAYMENTS_PAGE_SIZE, paymentsParamsOf, type PaymentsListState } from "@/lib/payments-query";
import { exportElementToPdf } from "@/lib/pdf-export";
import { useLanguage } from "@/lib/i18n/language-provider";
import { FeeFormDialog, type FeeEditTarget, type FeeStudentOption } from "./fee-form-dialog";
import { PaymentDialog } from "./payment-dialog";
import { deleteFee } from "./actions";
import { openFeesForPayment, paymentRowsForExport } from "./payments-list-actions";
import { PaymentsToolbar } from "./payments-list/payments-toolbar";
import { PaymentsTable, type FeeRowActions } from "./payments-list/payments-table";
import { PaymentsBulkBar } from "./payments-list/payments-bulk-bar";
import { FeeDetailSheet } from "./payments-list/fee-detail-sheet";
import { RemindersDialog } from "./payments-list/reminders-dialog";
import { PaymentsReport } from "./payments-list/payments-report";
import { FamilyFilterBanner } from "@/components/family/family-filter-banner";
import { FamilyPaymentDialog } from "../familles/family-view/family-payment-dialog";
import type { FamilyOpenFee } from "../familles/family-view/types";
import { TuitionPlanDialog } from "@/components/finance/tuition-plan-dialog";

export interface FeeRow {
  id: string;
  label: string;
  amount: number;
  /** ISO */
  dueDate: string;
  totalPaid: number;
  remaining: number;
  /** Échéance d'une formule de paiement ; null pour un frais saisi à la main. */
  tuitionPlanId: string | null;
  /**
   * Échéance arrivée (aujourd'hui ou avant). Une échéance future — le mois
   * prochain d'une formule mensuelle — n'est ni un impayé, ni un reste dû, ni
   * un motif de relance : le parent ne la doit pas encore.
   */
  isDue: boolean;
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
  parent: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    relationship: string | null;
    familyName: string | null;
    /** Enfants rattachés à ce parent : sa famille, à partir de deux. */
    familySize: number;
  } | null;
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

export function FinanceView({
  state,
  rows,
  total,
  pageCount,
  hasFees,
  hasUnsettled,
  letters,
  classes,
  family,
  kpis,
  students,
  schoolName,
  reminderTemplate,
  reminderTemplateAr,
}: {
  /** Filtres, lettre, famille et page lus dans l'adresse (voir lib/payments-query). */
  state: PaymentsListState;
  /** Les lignes de la page affichée seulement. */
  rows: FeeRow[];
  /** Nombre de lignes de toute la liste filtrée. */
  total: number;
  pageCount: number;
  /** L'école a-t-elle au moins un frais (sinon : liste vide, pas « aucun résultat ») ? */
  hasFees: boolean;
  hasUnsettled: boolean;
  /** Lettres du filtre A-Z qui ont au moins un élève. */
  letters: string[];
  classes: { id: string; name: string }[];
  /** Famille filtrée (?famille=<parentId>) : son parent et ses frais encore dus. */
  family: { parent: NonNullable<FeeRow["parent"]>; openFees: FamilyOpenFee[] } | null;
  kpis: PaymentsKpis;
  students: FeeStudentOption[];
  schoolName: string;
  reminderTemplate: string;
  reminderTemplateAr?: string;
}) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  // La recherche est tapée ici puis envoyée au serveur après une courte pause.
  const [query, setQuery] = useState(state.filters.query);
  const pushedQuery = useRef(state.filters.query);
  const [panelOpen, setPanelOpen] = useState(false);
  // Sélection gardée d'une page à l'autre : la ligne entière, pour les rappels et l'export.
  const [selected, setSelected] = useState<Map<string, FeeRow>>(() => new Map());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [feeForm, setFeeForm] = useState<{ edit: FeeEditTarget | null } | null>(null);
  // "" : la fenêtre est ouverte et le directeur choisit l'élève.
  const [tuitionFor, setTuitionFor] = useState<string | null>(null);
  const [paymentFor, setPaymentFor] = useState<{ feeId: string | null; fees: FeeRow[] } | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FeeRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [exportRows, setExportRows] = useState<FeeRow[] | null>(null);
  const [familyPayOpen, setFamilyPayOpen] = useState(false);

  // Adresse changée ailleurs (menu « Impayés », retour arrière) : la recherche suit.
  useEffect(() => {
    if (state.filters.query !== pushedQuery.current) {
      pushedQuery.current = state.filters.query;
      setQuery(state.filters.query);
    }
  }, [state.filters.query]);

  /** Nouvel état de la liste : l'adresse change, le serveur renvoie la page. */
  function navigate(next: PaymentsListState) {
    pushedQuery.current = next.filters.query;
    const qs = paymentsParamsOf(next);
    startNavigation(() => router.replace(`/directeur/finance${qs ? `?${qs}` : ""}`, { scroll: false }));
  }

  useEffect(() => {
    if (query === pushedQuery.current) return;
    const timer = setTimeout(() => navigate({ ...state, filters: { ...state.filters, query }, page: 1 }), 350);
    return () => clearTimeout(timer);
    // navigate et state sont relus à chaque frappe ; seule la saisie déclenche.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const filters: FeeListFilters = { ...state.filters, query };
  const currentPage = state.page;
  const pageRows = rows;
  const selectedFees = [...selected.values()];
  const detailFee = rows.find((f) => f.id === detailId) ?? selected.get(detailId ?? "") ?? null;
  const familyFilter = family ? state.family : null;
  const familyParent = family?.parent ?? null;
  const familyOpenFees = family?.openFees ?? [];

  /** Tout changement de filtre ramène à la première page. */
  function updateFilters(patch: Partial<FeeListFilters>) {
    if ("query" in patch) {
      setQuery(patch.query ?? "");
      if (Object.keys(patch).length === 1) return;
    }
    navigate({ ...state, filters: { ...state.filters, query, ...patch }, page: 1 });
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
      const next = new Map(prev);
      const row = rows.find((f) => f.id === id);
      if (next.has(id)) next.delete(id);
      else if (row) next.set(id, row);
      return next;
    });
  }

  function togglePage(checked: boolean) {
    setSelected((prev) => {
      const next = new Map(prev);
      for (const f of pageRows) {
        if (checked) next.set(f.id, f);
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

  /**
   * La fenêtre de paiement a besoin des frais encore dus (ceux de l'élève,
   * ou de toute l'école pour « Nouveau paiement ») : chargés à la demande,
   * puis la fenêtre s'ouvre — jamais de montant saisi remplacé en cours de route.
   */
  async function openPayment(fee: FeeRow | null) {
    setDetailId(null);
    if (loadingPayment) return;
    setLoadingPayment(true);
    const wait = toast.loading(t("common.loading"));
    try {
      const open = await openFeesForPayment(fee?.student.id);
      const fees = fee && !open.some((f) => f.id === fee.id) ? [fee, ...open] : open;
      setPaymentFor({ feeId: fee?.id ?? null, fees });
    } catch {
      toast.error(t("common.error"));
    } finally {
      toast.dismiss(wait);
      setLoadingPayment(false);
    }
  }

  const actions: FeeRowActions = {
    onView: (fee) => setDetailId(fee.id),
    onEdit: openEdit,
    onRecordPayment: openPayment,
    onDelete: setDeleteTarget,
    reminderUrl,
    onFamily: (parentId) => navigate({ ...state, family: parentId, page: 1 }),
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
        const next = new Map(prev);
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
   * Export PDF de lignes données : toute la liste filtrée (demandée au serveur
   * à ce moment-là), ou la sélection. Le document n'est rendu, hors écran, que
   * le temps de la capture — flushSync l'écrit dans la page avant la capture.
   */
  async function exportPdf(source: FeeRow[] | "filtered", suffix: string) {
    if (exportRows) return;
    let list: FeeRow[];
    try {
      list = source === "filtered" ? await paymentRowsForExport(paymentsParamsOf({ ...state, filters, page: 1 })) : source;
    } catch {
      toast.error(t("pdf.failed"));
      return;
    }
    if (list.length === 0) return;
    flushSync(() => setExportRows(list));
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
  const from = (currentPage - 1) * PAYMENTS_PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAYMENTS_PAGE_SIZE, total);

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
            onClick={() => exportPdf("filtered", "liste")}
            disabled={exportRows != null || total === 0}
          >
            {exportRows ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t("finance.exportPdf")}
          </Button>
          <Button variant="secondary" onClick={() => setTuitionFor("")} data-testid="finance-tuition">
            <CalendarClock className="h-4 w-4" />
            Formule de paiement
          </Button>
          <Button variant="secondary" onClick={() => setFeeForm({ edit: null })}>
            <FilePlus2 className="h-4 w-4" />
            {t("finance.newFee")}
          </Button>
          <Button
            className="shadow-sm"
            onClick={() => openPayment(null)}
            disabled={!hasUnsettled || loadingPayment}
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

      {familyFilter && familyParent && (
        <FamilyFilterBanner
          parentId={familyFilter}
          parent={familyParent}
          clearLabelKey="family.clearPayments"
          onClear={() => navigate({ ...state, family: null, page: 1 })}
          actions={
            <Button size="sm" className="h-9" onClick={() => setFamilyPayOpen(true)} disabled={familyOpenFees.length === 0}>
              <HandCoins className="h-4 w-4" />
              {t("family.payFamily")}
            </Button>
          }
        />
      )}

      <PaymentsToolbar
        filters={filters}
        onChange={updateFilters}
        classes={classes}
        panelOpen={panelOpen}
        onPanelOpenChange={setPanelOpen}
      />

      <AlphabetFilter
        names={letters}
        value={state.letter}
        onChange={(value) => navigate({ ...state, letter: value, page: 1 })}
      />

      <section
        className={`overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-soft transition-opacity ${isNavigating ? "opacity-60" : ""}`}
        aria-busy={isNavigating}
      >
        {selected.size > 0 && (
          <PaymentsBulkBar
            count={selected.size}
            exporting={exportRows != null}
            onRemind={() => setRemindersOpen(true)}
            onExport={() => exportPdf(selectedFees, "selection")}
            onClear={() => setSelected(new Map())}
          />
        )}
        {rows.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-foreground/50">
            {!hasFees ? t("finance.emptyList") : t("finance.noMatch")}
          </div>
        ) : (
          <>
            <PaymentsTable
              rows={pageRows}
              selected={new Set(selected.keys())}
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
                .replace("{total}", String(total))}
              previousLabel={t("students.previousPage")}
              nextLabel={t("students.nextPage")}
              onPageChange={(page) => navigate({ ...state, filters, page })}
            />
          </>
        )}
      </section>

      {familyFilter && (
        <FamilyPaymentDialog
          open={familyPayOpen}
          onOpenChange={setFamilyPayOpen}
          parentId={familyFilter}
          fees={familyOpenFees}
        />
      )}

      <FeeDetailSheet
        fee={detailFee}
        onClose={() => setDetailId(null)}
        onEdit={openEdit}
        onRecordPayment={openPayment}
        reminderUrl={reminderUrl}
      />
      <TuitionPlanDialog
        studentId={tuitionFor}
        students={students.map((s) => ({
          id: s.id,
          name: `${s.firstName} ${s.lastName}${s.className ? ` — ${s.className}` : ""}`,
        }))}
        onOpenChange={(open) => !open && setTuitionFor(null)}
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
        fees={paymentFor?.fees ?? []}
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
