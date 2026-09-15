"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Banknote, MessageCircle, Pencil, Phone, Receipt } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StudentAvatar } from "@/components/students/student-avatar";
import { PaymentMethodIcon } from "@/components/payments/payment-method-label";
import { formatDate, formatMRU } from "@/lib/format";
import { isPaymentMethod } from "@/lib/payment-methods";
import { buildTelUrl } from "@/lib/whatsapp";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import type { FeeRow } from "../finance-view";
import { FeeStatusBadge, overdueText } from "./fee-status-badge";
import { parentLine } from "./parent-line";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-foreground/55">{label}</dt>
      <dd className="min-w-0 text-end text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

const heading = "text-xs font-semibold uppercase tracking-wider text-primary-700";
const tabular = { fontVariantNumeric: "tabular-nums" } as const;

/**
 * Fiche d'un frais (bouton « œil ») : montants et échéance, parent à relancer,
 * et l'historique des versements avec leurs reçus.
 */
export function FeeDetailSheet({
  fee,
  onClose,
  onEdit,
  onRecordPayment,
  reminderUrl,
}: {
  fee: FeeRow | null;
  onClose: () => void;
  onEdit: (fee: FeeRow) => void;
  onRecordPayment: (fee: FeeRow) => void;
  reminderUrl: (fee: FeeRow) => string | null;
}) {
  const { t } = useLanguage();
  const reminder = fee ? reminderUrl(fee) : null;
  const paidPercent =
    fee && fee.amount > 0 ? Math.min(100, Math.round((fee.totalPaid / fee.amount) * 100)) : 0;
  const paidLabel = t("finance.paidPercent").replace("{n}", String(paidPercent));

  return (
    <Sheet open={Boolean(fee)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent closeLabel={t("common.close")}>
        {fee && (
          <>
            <div className="border-b border-primary-200 bg-gradient-to-br from-primary-50 via-surface to-emerald-50 px-6 pb-5 pt-8">
              <div className="flex items-center gap-4 pe-6">
                <StudentAvatar
                  firstName={fee.student.firstName}
                  lastName={fee.student.lastName}
                  photoUrl={fee.student.photoUrl}
                  size="lg"
                />
                <div className="min-w-0">
                  <SheetTitle className="text-xl font-bold leading-tight text-foreground">
                    {fee.student.firstName} {fee.student.lastName}
                  </SheetTitle>
                  <SheetDescription className="mt-2 flex flex-wrap items-center gap-1.5">
                    {fee.student.className && (
                      <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-primary-700 ring-1 ring-primary-100">
                        {fee.student.className}
                      </span>
                    )}
                    <FeeStatusBadge status={fee.status} />
                  </SheetDescription>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <section>
                <h3 className={heading}>{t("finance.feeDetails")}</h3>
                <dl className="mt-1 divide-y divide-border/70">
                  <Row label={t("finance.colFeeType")}>{fee.label}</Row>
                  <Row label={t("finance.amount")}>
                    <span style={tabular}>{formatMRU(fee.amount)}</span>
                  </Row>
                  <Row label={t("finance.paidSoFar")}>
                    <span style={tabular}>{formatMRU(fee.totalPaid)}</span>
                  </Row>
                  <Row label={t("finance.remaining")}>
                    <span
                      className={fee.remaining > 0 ? "font-bold text-red-700" : "font-bold text-emerald-700"}
                      style={tabular}
                    >
                      {formatMRU(fee.remaining)}
                    </span>
                  </Row>
                  <Row label={t("finance.dueDate")}>
                    <span dir="ltr">{formatDate(fee.dueDate)}</span>
                    {fee.overdueDays > 0 && (
                      <span className="block text-xs font-normal text-red-600">
                        {overdueText(fee.overdueDays, t)}
                      </span>
                    )}
                  </Row>
                </dl>
                <div className="mt-3">
                  <div
                    className="h-2 overflow-hidden rounded-full bg-surface-muted"
                    role="progressbar"
                    aria-valuenow={paidPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={paidLabel}
                  >
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${paidPercent}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-foreground/55">{paidLabel}</p>
                </div>
              </section>

              {fee.parent && (
                <section>
                  <h3 className={heading}>{t("finance.parentLabel")}</h3>
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-border px-3.5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{parentLine(fee, t)}</p>
                      <p className="text-xs text-foreground/55" dir="ltr">
                        {fee.parent.phone}
                      </p>
                    </div>
                    <a
                      href={buildTelUrl(fee.parent.phone)}
                      title={t("students.callParent")}
                      aria-label={t("students.callParent")}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-blue-600 transition-colors hover:bg-blue-50"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                    {reminder && (
                      <a
                        href={reminder}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t("finance.sendReminder")}
                        aria-label={t("finance.sendReminder")}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-50"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </section>
              )}

              <section>
                <h3 className={heading}>{t("finance.paymentHistory")}</h3>
                {fee.payments.length === 0 ? (
                  <p className="mt-2 rounded-xl bg-surface-muted/50 px-4 py-3 text-sm text-foreground/50">
                    {t("finance.noPaymentRecorded")}
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {[...fee.payments].reverse().map((p) => (
                      <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2.5">
                        <PaymentMethodIcon method={p.method} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground" style={tabular}>
                            {formatMRU(p.amount)}
                          </p>
                          <p className="truncate text-xs text-foreground/55">
                            <span dir="ltr">{formatDate(p.paidAt)}</span>
                            {" · "}
                            {isPaymentMethod(p.method)
                              ? t(`finance.methodShort.${p.method}` as TranslationKey)
                              : p.method}
                            {" · "}
                            <span dir="ltr">{p.receiptNumber}</span>
                          </p>
                        </div>
                        <Link
                          href={`/directeur/finance/recus/${p.id}`}
                          target="_blank"
                          title={t("finance.viewReceipt")}
                          aria-label={t("finance.viewReceipt")}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground/55 transition-colors hover:bg-surface-muted hover:text-primary-700"
                        >
                          <Receipt className="h-4 w-4" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div className="flex gap-2 border-t border-border px-6 py-4">
              <Button variant="secondary" className="flex-1" onClick={() => onEdit(fee)}>
                <Pencil className="h-4 w-4" />
                {t("finance.editFee")}
              </Button>
              {fee.remaining > 0 && (
                <Button className="flex-1" onClick={() => onRecordPayment(fee)}>
                  <Banknote className="h-4 w-4" />
                  {t("finance.recordPayment")}
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
