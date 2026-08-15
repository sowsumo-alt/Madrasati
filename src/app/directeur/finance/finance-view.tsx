"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Receipt,
  Wallet,
  AlertCircle,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { WhatsAppLink } from "@/components/ui/whatsapp-link";
import { formatMRU, formatAmount, formatDate } from "@/lib/format";
import { fillTemplate } from "@/lib/whatsapp";
import { FeeFormDialog, type FeeStudentOption } from "./fee-form-dialog";
import { PaymentDialog } from "./payment-dialog";
import { useLanguage } from "@/lib/i18n/language-provider";
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

function displayStatus(fee: FeeRow) {
  if (fee.status !== "PAID" && new Date(fee.dueDate) < new Date()) {
    return "OVERDUE";
  }
  return fee.status;
}

const STATUS_FILTERS = ["ALL", "PENDING", "PARTIAL", "PAID", "OVERDUE"] as const;

export function FinanceView({
  fees,
  students,
  schoolName,
  reminderTemplate,
}: {
  fees: FeeRow[];
  students: FeeStudentOption[];
  schoolName: string;
  reminderTemplate: string;
}) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [feeFormOpen, setFeeFormOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<{
    feeId: string;
    studentName: string;
    label: string;
    remaining: number;
  } | null>(null);

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
      const status = displayStatus(f);
      const matchesStatus = statusFilter === "ALL" || status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [fees, query, statusFilter]);

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
                  const status = displayStatus(f);
                  const remaining = Math.max(f.amount - f.totalPaid, 0);
                  const lastReceipt = f.payments[f.payments.length - 1];
                  const reminderMessage = f.parent
                    ? fillTemplate(reminderTemplate, {
                        parentName: `${f.parent.firstName} ${f.parent.lastName}`,
                        studentName: `${f.student.firstName} ${f.student.lastName}`,
                        amount: formatAmount(remaining),
                        schoolName,
                      })
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
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {formatDate(f.dueDate)}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={STATUS_VARIANT[status]}>
                          {t(STATUS_KEYS[status])}
                        </Badge>
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
    </div>
  );
}
