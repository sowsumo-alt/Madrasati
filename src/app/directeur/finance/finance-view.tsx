"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Receipt,
  Wallet,
  AlertCircle,
  Banknote,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { WhatsAppLink } from "@/components/ui/whatsapp-link";
import { formatMRU, formatAmount, formatDate, formatLongDate, formatLongDateAr } from "@/lib/format";
import { fillTemplate, withArabic, schoolSignatureFr, schoolSignatureAr } from "@/lib/whatsapp";
import { FeeFormDialog, type FeeStudentOption } from "./fee-form-dialog";
import { PaymentDialog } from "./payment-dialog";
import { useLanguage } from "@/lib/i18n/language-provider";
import { AlphabetFilter, matchesLetter } from "@/components/ui/alphabet-filter";
import { feeDisplayStatus, isLate, remainingOf } from "@/lib/fee-status";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteFee } from "./actions";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

export interface FeeRow {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  status: string;
  totalPaid: number;
  student: { id: string; firstName: string; lastName: string; className: string | null };
  parent: { firstName: string; lastName: string; phone: string } | null;
  payments: { id: string; receiptNumber: string }[];
}

const STATUS_KEYS: Record<string, TranslationKey> = {
  PENDING: "finance.status.PENDING",
  PARTIAL: "finance.status.PARTIAL",
  PAID: "finance.status.PAID",
  OVERDUE: "finance.status.OVERDUE",
};

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  PENDING: "neutral",
  PARTIAL: "warning",
  PAID: "success",
  OVERDUE: "danger",
};

// Le statut affiché et le retard sont calculés dans lib/fee-status.ts,
// hors de cet écran, pour être verrouillés par des tests.

const STATUS_FILTERS = ["ALL", "PENDING", "PARTIAL", "PAID", "OVERDUE"] as const;

/**
 * Ancienneté d'un impayé, en jours puis en mois. Calculée sur les dates
 * civiles pour que le compte ne dépende pas de l'heure de consultation.
 */
function formatOverdue(dueDate: string, t: (key: TranslationKey) => string) {
  const startOfDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round(
    (startOfDay(new Date()) - startOfDay(new Date(dueDate))) / 86_400_000,
  );
  if (days <= 0) return "";
  if (days === 1) return t("finance.overdueOneDay");
  if (days < 31) return t("finance.overdueDays").replace("{n}", String(days));
  const months = Math.floor(days / 30);
  return months === 1
    ? t("finance.overdueOneMonth")
    : t("finance.overdueMonths").replace("{n}", String(months));
}

export function FinanceView({
  fees,
  students,
  schoolName,
  reminderTemplate,
  reminderTemplateAr,
}: {
  fees: FeeRow[];
  students: FeeStudentOption[];
  schoolName: string;
  reminderTemplate: string;
  reminderTemplateAr?: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const schoolFr = schoolSignatureFr(schoolName);
  const schoolAr = schoolSignatureAr(schoolName);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [letter, setLetter] = useState<string | null>(null);
  const [feeFormOpen, setFeeFormOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<{
    feeId: string;
    studentName: string;
    label: string;
    remaining: number;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeeRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  /**
   * Un frais déjà réglé n'est pas supprimable : ses paiements partiraient avec
   * lui (onDelete: Cascade), emportant des reçus déjà remis aux parents. Le
   * bouton n'apparaît donc que tant qu'aucun paiement n'est rattaché — plutôt
   * que de le proposer pour finir par un refus.
   */
  async function handleDeleteFee() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFee(deleteTarget.id);
      toast.success(t("finance.feeDeleted"));
      setDeleteTarget(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setDeleting(false);
    }
  }

  const totalCollected = useMemo(
    () => fees.reduce((sum, f) => sum + f.totalPaid, 0),
    [fees],
  );
  const totalOutstanding = useMemo(
    () => fees.reduce((sum, f) => sum + Math.max(f.amount - f.totalPaid, 0), 0),
    [fees],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fees.filter((f) => {
      const name = `${f.student.firstName} ${f.student.lastName}`.toLowerCase();
      const matchesQuery = !q || name.includes(q) || f.label.toLowerCase().includes(q);
      const status = feeDisplayStatus(f);
      const matchesStatus = statusFilter === "ALL" || status === statusFilter;
      const matchesInitial = matchesLetter(
        `${f.student.firstName} ${f.student.lastName}`,
        letter,
      );
      return matchesQuery && matchesStatus && matchesInitial;
    });
  }, [fees, query, statusFilter, letter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("finance.title")}</h1>
          <p className="mt-1 text-sm text-foreground/60">{t("finance.subtitle")}</p>
        </div>
        <Button onClick={() => setFeeFormOpen(true)}>
          <Plus className="h-4 w-4" />
          {t("finance.newFee")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile
          label={t("finance.totalCollected")}
          value={formatMRU(totalCollected)}
          icon={Wallet}
          tone="primary"
        />
        <StatTile
          label={t("finance.totalOutstanding")}
          value={formatMRU(totalOutstanding)}
          icon={AlertCircle}
          tone="warning"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("finance.searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary-700 text-white"
                  : "bg-surface-muted text-foreground/60 hover:text-foreground"
              }`}
            >
              {s === "ALL" ? t("common.all") : t(STATUS_KEYS[s])}
            </button>
          ))}
        </div>
      </div>

      {/* Meme acces par initiale que sur la page Eleves : la liste des frais
          est la plus longue de l application, un frais par eleve et par
          trimestre. */}
      <AlphabetFilter
        names={fees.map((f) => `${f.student.firstName} ${f.student.lastName}`)}
        value={letter}
        onChange={setLetter}
      />

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-foreground/50">
            {fees.length === 0 ? t("finance.emptyList") : t("finance.noMatch")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                  <th className="px-5 py-3">{t("finance.student")}</th>
                  <th className="px-5 py-3">{t("finance.label")}</th>
                  <th className="px-5 py-3">{t("finance.amount")}</th>
                  <th className="px-5 py-3">{t("finance.dueDate")}</th>
                  <th className="px-5 py-3">{t("finance.status")}</th>
                  <th className="px-5 py-3 text-right">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((f) => {
                  const status = feeDisplayStatus(f);
                  const remaining = remainingOf(f);
                  const lastReceipt = f.payments[f.payments.length - 1];
                  const reminderMessage = f.parent
                    ? withArabic(
                        fillTemplate(reminderTemplate, {
                          parentName: `${f.parent.firstName} ${f.parent.lastName}`,
                          studentName: `${f.student.firstName} ${f.student.lastName}`,
                          amount: formatAmount(remaining),
                          date: formatLongDate(f.dueDate),
                          schoolName: schoolFr,
                        }),
                        reminderTemplateAr &&
                          fillTemplate(reminderTemplateAr, {
                            parentName: `${f.parent.firstName} ${f.parent.lastName}`,
                            studentName: `${f.student.firstName} ${f.student.lastName}`,
                            amount: formatAmount(remaining),
                            date: formatLongDateAr(f.dueDate),
                            schoolName: schoolAr,
                          }),
                      )
                    : "";

                  return (
                    <tr key={f.id} className="hover:bg-surface-muted/40">
                      <td className="px-5 py-3 font-medium text-foreground">
                        {f.student.firstName} {f.student.lastName}
                        {f.student.className && (
                          <span className="ml-1.5 text-xs font-normal text-foreground/40">
                            {f.student.className}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-foreground/70">{f.label}</td>
                      <td className="px-5 py-3 text-foreground/70">
                        {formatMRU(f.amount)}
                        {/* Sans cette ligne, la colonne affichait le montant
                            facturé et rien d'autre : un versement partiel
                            n'y laissait aucune trace, et c'est le reste dû —
                            pas le montant d'origine — que le directeur doit
                            réclamer. */}
                        {f.totalPaid > 0 && remaining > 0 && (
                          <span className="mt-0.5 block whitespace-nowrap text-xs">
                            <span className="font-medium text-warning">
                              {t("finance.remainingIs").replace("{amount}", formatMRU(remaining))}
                            </span>
                            <span className="text-foreground/45">
                              {" · "}
                              {t("finance.alreadyPaid").replace("{amount}", formatMRU(f.totalPaid))}
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {formatDate(f.dueDate)}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={STATUS_VARIANT[status]}>
                          {t(STATUS_KEYS[status])}
                        </Badge>
                        {/* Une échéance d'octobre dernier et une d'avant-hier
                            portaient le même badge : l'ancienneté du retard est
                            ce qui dit laquelle relancer en premier. Affiché
                            aussi sur un frais partiellement réglé, qui reste en
                            retard sans porter le badge « Impayé ». */}
                        {isLate(f) && (
                          <span className="ml-1.5 whitespace-nowrap text-xs text-danger">
                            {formatOverdue(f.dueDate, t)}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {status !== "PAID" && f.parent && (
                            <WhatsAppLink
                              phone={f.parent.phone}
                              message={reminderMessage}
                              title={t("finance.sendReminder")}
                            />
                          )}
                          {status !== "PAID" && (
                            <button
                              title={t("finance.recordPayment")}
                              onClick={() =>
                                setPaymentTarget({
                                  feeId: f.id,
                                  studentName: `${f.student.firstName} ${f.student.lastName}`,
                                  label: f.label,
                                  remaining,
                                })
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                            >
                              <Banknote className="h-4 w-4" />
                            </button>
                          )}
                          {lastReceipt && (
                            <Link
                              href={`/directeur/finance/recus/${lastReceipt.id}`}
                              target="_blank"
                              title={t("finance.viewReceipt")}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                            >
                              <Receipt className="h-4 w-4" />
                            </Link>
                          )}
                          {f.payments.length === 0 && (
                            <button
                              title={t("finance.deleteFee")}
                              onClick={() => setDeleteTarget(f)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-red-50 hover:text-danger"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
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

      <FeeFormDialog open={feeFormOpen} onOpenChange={setFeeFormOpen} students={students} />
      <PaymentDialog target={paymentTarget} onOpenChange={(open) => !open && setPaymentTarget(null)} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("finance.deleteFeeTitle")}
        description={
          deleteTarget
            ? t("finance.deleteFeeHint")
                .replace("{label}", deleteTarget.label)
                .replace(
                  "{student}",
                  `${deleteTarget.student.firstName} ${deleteTarget.student.lastName}`,
                )
                .replace("{amount}", formatMRU(deleteTarget.amount))
            : undefined
        }
        confirmLabel={t("finance.deleteFee")}
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteFee}
      />
    </div>
  );
}
